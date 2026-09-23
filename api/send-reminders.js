// Daily reminder job (Vercel Cron — see vercel.json). Replaces the loop that
// used to run in every open dashboard tab.
//
// For each form waiting on the client (status 'pending_intake'), picks the
// single highest tier that is due, measured from when the intake form was
// sent. The row is CLAIMED with a conditional update before anything is sent,
// so overlapping runs cannot both send; lower tiers are marked at the same
// time so a late first run sends one email, not three. If the webhook fails
// the claim is released so the next run retries.

import { getAdminClient, postWebhook, publicUrl, sendError, validateRecipient } from './_lib/server.js';

const HOUR = 60 * 60 * 1000;
const TIERS = [
  { key: '2w', column: 'reminder_2w_sent', afterHours: 14 * 24 },
  { key: '1w', column: 'reminder_1w_sent', afterHours: 7 * 24 },
  { key: '3d', column: 'reminder_3d_sent', afterHours: 3 * 24 },
];

const REMINDER_WEBHOOK = process.env.REMINDER_WEBHOOK || process.env.VITE_REMINDER_WEBHOOK || '';

/** Postgres `timestamp` (no zone) values are stored as UTC. */
function parseUtc(value) {
  if (!value) return null;
  const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * The reminder to send now, if any: the highest tier that is due, unless that
 * tier was already sent. Returns its index in TIERS, or -1.
 */
export function dueTierIndex(form, now) {
  const sentAt = parseUtc(form.intake_sent_at);
  if (!sentAt) return -1;
  const hoursWaiting = (now - sentAt.getTime()) / HOUR;
  const index = TIERS.findIndex((t) => hoursWaiting >= t.afterHours);
  if (index === -1 || form[TIERS[index].column]) return -1;
  return index;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getAdminClient();
    const { data: forms, error } = await supabase
      .from('forms')
      .select('id, client_name, client_email, intake_sent_at, reminder_3d_sent, reminder_1w_sent, reminder_2w_sent')
      .eq('status', 'pending_intake')
      .not('intake_sent_at', 'is', null);
    if (error) throw error;

    const now = Date.now();
    const report = { checked: forms.length, sent: [], skipped: [], failed: [] };

    for (const form of forms) {
      const dueIndex = dueTierIndex(form, now);
      if (dueIndex === -1) continue;
      const tier = TIERS[dueIndex];
      const hoursWaiting = (now - parseUtc(form.intake_sent_at).getTime()) / HOUR;

      const invalid = validateRecipient(form.client_email);
      if (invalid) {
        report.skipped.push({ id: form.id, reason: invalid });
        continue;
      }

      // Built before the claim so a configuration error cannot leave a
      // reminder marked as sent without it being sent.
      const formLink = publicUrl(`/intake-form?lead_id=${form.id}`);

      // Claim this tier and every lower one in one conditional update.
      const stamp = new Date().toISOString();
      const claim = {};
      for (const t of TIERS.slice(dueIndex)) claim[t.column] = form[t.column] || stamp;
      const { data: claimed, error: claimError } = await supabase
        .from('forms')
        .update(claim)
        .eq('id', form.id)
        .eq('status', 'pending_intake')
        .is(tier.column, null)
        .select('id');
      if (claimError) {
        report.failed.push({ id: form.id, reason: claimError.message });
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // another run got it, or status changed

      const release = {};
      for (const t of TIERS.slice(dueIndex)) release[t.column] = form[t.column] || null;

      let result;
      try {
        result = await postWebhook(
          REMINDER_WEBHOOK,
          {
            form_id: form.id,
            client_name: form.client_name,
            client_email: form.client_email.trim(),
            form_link: formLink,
            reminder_type: tier.key,
            days_old: Math.floor(hoursWaiting / 24),
            sent_at: stamp,
          },
          `${tier.key} reminder`,
        );
      } catch (err) {
        result = { ok: false, detail: err instanceof Error ? err.message : String(err) };
      }

      if (result.ok) {
        report.sent.push({ id: form.id, tier: tier.key });
      } else {
        await supabase.from('forms').update(release).eq('id', form.id);
        report.failed.push({ id: form.id, reason: result.detail });
      }
    }

    return res.status(200).json(report);
  } catch (err) {
    return sendError(res, err);
  }
}
