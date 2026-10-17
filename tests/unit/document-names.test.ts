import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentFileName, firmDateStamp } from '../../artifacts/questionnaire/src/lib/documentNames.ts';

test('names follow "<yymmdd> DRAFT <kind> - <full name>"', () => {
  const now = new Date('2026-10-14T03:00:00Z');
  assert.equal(documentFileName('standard_will', 'Standard Will', 'Isuru Abeysekara', now), '261014 DRAFT Will - Isuru Abeysekara');
  assert.equal(documentFileName('tt_will', 'Will with Testamentary Trust', 'Test Client', now), '261014 DRAFT Will - Test Client');
  assert.equal(documentFileName('epa', 'Enduring Power of Attorney', 'Test Client', now), '261014 DRAFT POA - Test Client');
  assert.equal(documentFileName('acd', 'Advance Care Directive', 'Test Client', now), '261014 DRAFT ACD - Test Client');
});

test('23:30 UTC is already the next day in Adelaide', () => {
  // 13 Oct 23:30 UTC = 14 Oct 10:00 ACDT (UTC+10:30).
  const now = new Date('2026-10-13T23:30:00Z');
  assert.equal(now.toISOString().slice(0, 10), '2026-10-13');
  assert.equal(documentFileName('standard_will', 'Standard Will', 'Test Client', now), '261014 DRAFT Will - Test Client');
});

test('the date turns over at Adelaide midnight, in and out of daylight saving', () => {
  // Winter, ACST (UTC+9:30).
  assert.equal(firmDateStamp(new Date('2026-06-30T14:29:00Z')), '260630');
  assert.equal(firmDateStamp(new Date('2026-06-30T14:30:00Z')), '260701');
  // Summer, ACDT (UTC+10:30).
  assert.equal(firmDateStamp(new Date('2026-12-31T13:29:00Z')), '261231');
  assert.equal(firmDateStamp(new Date('2026-12-31T13:30:00Z')), '270101');
});

test('each spouse of a couple gets their own name, with no stray spacing', () => {
  const now = new Date('2026-10-14T03:00:00Z');
  assert.equal(documentFileName('standard_will', 'Standard Will', ' Test  Spouse ', now), '261014 DRAFT Will - Test Spouse');
});
