import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveFromDisplayNumber, normaliseMatter } from '../../api/_lib/clio-client.ts';

// Make names matters from matter_description from CR 2026-10-14 on.
test('a single named from matter_description', () => {
  const d = deriveFromDisplayNumber('1000001-Estate Planning - Single - Client, Test');
  assert.deepEqual(d, { name: 'Test Client', isCouple: false, mr: '', mrs: '', fromIntake: true });
});

test('a couple named from matter_description takes the spouse from SpouseName', () => {
  const m = normaliseMatter({
    id: 1000002,
    display_number: '1000002-Estate Planning - Couple - Client-Two, Test',
    client: { name: '******' },
    custom_field_values: [{ field_name: 'SpouseName', value: 'Test Spouse' }],
  });
  assert.equal(m.is_couple, true);
  assert.equal(m.client_name, 'Test Client-Two');
  assert.equal(m.mr_name, 'Test Client-Two');
  assert.equal(m.mrs_name, 'Test Spouse');
});

test('the old Make naming still reads both spouses', () => {
  const d = deriveFromDisplayNumber('1000002-TestClient-Two (Test Engineer) and Test Spouse (Test Teacher) - Married - Mirror wills - Client-Two, Test');
  assert.equal(d.isCouple, true);
  assert.equal(d.mrs, 'Test Spouse');
});
