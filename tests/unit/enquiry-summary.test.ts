import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENQUIRY_FIELDS, enquiryRows, isEarlyExitEnquiry } from '../../artifacts/questionnaire/src/lib/enquiry-summary.ts';

const HTML = readFileSync(join(import.meta.dirname, '..', '..', 'artifacts', 'questionnaire', 'public', 'lead-inquiry.html'), 'utf8');

test('dashboard labels match buildSummaryHtml in lead-inquiry.html, in the same order', () => {
  const body = HTML.match(/function buildSummaryHtml\(lead\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'buildSummaryHtml not found in lead-inquiry.html');
  const fromHtml = [...body.matchAll(/renderField\('([^']+)', (?:toArray\()?lead\.(\w+)/g)].map((m) => ({ key: m[2], label: m[1] }));
  assert.deepEqual(fromHtml, ENQUIRY_FIELDS.map(({ key, label }) => ({ key, label })));
});

test('every input the enquiry form stores has a dashboard label', () => {
  const names = new Set([...HTML.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="(\w+)"/g)].map((m) => m[1]));
  assert.ok(names.size >= 12, 'expected to find the enquiry inputs');
  const labelled = new Set(ENQUIRY_FIELDS.map((f) => f.key));
  assert.deepEqual([...names].filter((n) => !labelled.has(n)), []);
});

test('enquiryRows lists every answer, joins lists, skips blanks and keeps unknown keys', () => {
  const rows = enquiryRows({
    inquiry_reason: 'Put a will or estate plan in place',
    client_name: 'Test Client',
    client_email: 'isuru+test@lex-ops.io',
    client_phone: '',
    complexity_flags: ['Already have a will', 'Children under 18'],
    goal: 'A will — who receives what',
    additional_notes: 'Test note',
    some_new_question: 'Test answer',
  });
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [
    ['Reason for enquiry', 'Put a will or estate plan in place'],
    ['Full name', 'Test Client'],
    ['Email', 'isuru+test@lex-ops.io'],
    ['Applicable factors', 'Already have a will, Children under 18'],
    ['Goals', 'A will — who receives what'],
    ['Additional notes', 'Test note'],
    ['Some new question', 'Test answer'],
  ]);
});

test('early_exit is a flag, not an answer', () => {
  const inquiry = { inquiry_reason: 'Someone has died', client_name: 'Test Client', early_exit: true };
  assert.equal(isEarlyExitEnquiry(inquiry), true);
  assert.deepEqual(enquiryRows(inquiry).map((r) => r.key), ['inquiry_reason', 'client_name']);
  assert.equal(isEarlyExitEnquiry({ inquiry_reason: 'Update an existing one' }), false);
  assert.equal(isEarlyExitEnquiry(undefined), false);
  assert.deepEqual(enquiryRows(undefined), []);
});
