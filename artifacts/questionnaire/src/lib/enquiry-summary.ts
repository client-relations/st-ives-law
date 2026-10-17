// The enquiry answers the dashboard shows, under the labels the client saw on
// their own confirmation page. Mirrors buildSummaryHtml in
// public/lead-inquiry.html (a static page, so it cannot import this module);
// tests/unit/enquiry-summary.test.ts fails when the two lists drift apart.

export const ENQUIRY_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'inquiry_reason', label: 'Reason for enquiry' },
  { key: 'client_name', label: 'Full name' },
  { key: 'client_email', label: 'Email' },
  { key: 'client_phone', label: 'Phone' },
  { key: 'client_state', label: 'State/Territory' },
  { key: 'complexity_flags', label: 'Applicable factors' },
  { key: 'asset_flags', label: 'Assets owned' },
  { key: 'goal', label: 'Goals' },
  { key: 'executor_confidence', label: 'Executor' },
  { key: 'gifts_volume', label: 'Specific gifts' },
  { key: 'funeral_wishes', label: 'Funeral wishes' },
  { key: 'additional_notes', label: 'Additional notes' },
];

/** Keys the form stores about the submission itself, not as an answer. */
const NOT_ANSWERS = new Set(['early_exit']);

export type EnquiryRow = { key: string; label: string; value: string };

function display(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

/**
 * Every saved enquiry answer, in form order. Answers under a key this list
 * does not know (a question added later, an older form) are still shown,
 * labelled by their key, so nothing the client told us is hidden.
 */
export function enquiryRows(inquiry: Record<string, unknown> | null | undefined): EnquiryRow[] {
  if (!inquiry || typeof inquiry !== 'object') return [];
  const known = new Set(ENQUIRY_FIELDS.map((f) => f.key));
  const rows: EnquiryRow[] = ENQUIRY_FIELDS.map(({ key, label }) => ({ key, label, value: display(inquiry[key]) }));
  for (const key of Object.keys(inquiry)) {
    if (known.has(key) || NOT_ANSWERS.has(key)) continue;
    rows.push({ key, label: key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value: display(inquiry[key]) });
  }
  return rows.filter((row) => row.value !== '');
}

/** The client stopped after Q2 (e.g. "Someone has died"), so Q3-Q8 were never asked. */
export function isEarlyExitEnquiry(inquiry: Record<string, unknown> | null | undefined): boolean {
  return !!inquiry && inquiry.early_exit === true;
}
