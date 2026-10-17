import { test } from 'node:test';
import assert from 'node:assert/strict';
// Importing this logs "Supabase is not configured" once: there is no Vite env
// here, and every test passes its own fake client instead.
import { markScheduled, markScheduledWarning } from '../../artifacts/questionnaire/src/lib/dashboard-actions.ts';

const FORM_ID = '00000000-0000-4000-8000-000000000001';

/** Records the query chain and answers it with `result`, like supabase-js. */
function fakeClient(result: { data?: unknown; error?: unknown } | Error) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: any = {
    update: (values: unknown) => { calls.push(['update', values]); return chain; },
    eq: (column: string, value: unknown) => { calls.push(['eq', column, value]); return chain; },
    select: (columns: string) => {
      calls.push(['select', columns]);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  const client: any = { from: (table: string) => { calls.push(['from', table]); return chain; } };
  return { client, calls };
}

test('markScheduled moves only a form that is still in appointment_sent', async () => {
  const { client, calls } = fakeClient({ data: [{ id: FORM_ID }], error: null });
  const result = await markScheduled(FORM_ID, client);

  assert.deepEqual(result, { ok: true, data: undefined, message: 'Marked as scheduled.' });
  assert.deepEqual(calls, [
    ['from', 'forms'],
    ['update', { status: 'scheduled' }],
    ['eq', 'id', FORM_ID],
    ['eq', 'status', 'appointment_sent'],
    ['select', 'id'],
  ]);
});

test('markScheduled reports STALE when no row matched (moved, deleted, or not yours)', async () => {
  for (const data of [[], null]) {
    const { client } = fakeClient({ data, error: null });
    const result = await markScheduled(FORM_ID, client);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'STALE');
    assert.match(!result.ok ? result.error : '', /changed by someone else/);
  }
});

test('markScheduled turns database and network errors into readable messages', async () => {
  const denied = await markScheduled(FORM_ID, fakeClient({ data: null, error: { message: 'new row violates row-level security policy' } }).client);
  assert.deepEqual(denied, { ok: false, error: 'You do not have permission to do that.', code: undefined });

  const offline = await markScheduled(FORM_ID, fakeClient(new TypeError('Failed to fetch')).client);
  assert.equal(offline.ok, false);
  assert.match(!offline.ok ? offline.error : '', /Could not reach the server/);
});

test('markScheduledWarning: no enquiry, early exit, completed enquiry', () => {
  assert.match(markScheduledWarning({}) || '', /not completed the enquiry/);
  assert.match(markScheduledWarning(null) || '', /not completed the enquiry/);
  assert.match(markScheduledWarning({ inquiry: { inquiry_reason: 'Someone has died', early_exit: true } }) || '', /after question 2/);
  assert.equal(markScheduledWarning({ inquiry: { inquiry_reason: 'Update an existing one', goal: 'A will — who receives what' } }), null);
});
