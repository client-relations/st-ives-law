import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClioPayload } from '../../api/_lib/clio-payload.ts';

const form = { id: 'form-1', client_name: 'Test Client', lead_type: 'Estate planning', region: 'SA', created_at: '2026-10-01' };

test('matter_description for a single client', () => {
  const p = buildClioPayload({ scenario: 'Single', client_name: 'Test Client' }, form, {});
  assert.equal(p.matter_description, 'Estate Planning - Single - Client, Test');
  assert.equal(p.lead_type, 'Estate planning');
});

test('matter_description for a couple uses the primary client', () => {
  const p = buildClioPayload({ scenario: 'Couple', client_name: 'Test Client-Two', spouse_name: 'Test Spouse' }, form, {});
  assert.equal(p.matter_description, 'Estate Planning - Couple - Client-Two, Test');
});

test('a multi-word surname stays whole', () => {
  const p = buildClioPayload({ scenario: 'Single', client_name: 'Test Van Der Client' }, form, {});
  assert.equal(p.matter_description, 'Estate Planning - Single - Van Der Client, Test');
});

test('gender is passed through, spouse only for a couple', () => {
  const single = buildClioPayload({ scenario: 'Single', client_name: 'Test Client', client_gender: 'Female', spouse_gender: 'Male' }, form, {});
  assert.equal(single.client_gender, 'Female');
  assert.equal(single.spouse_gender, '');
  const couple = buildClioPayload({ scenario: 'Couple', client_name: 'Test Client', client_gender: 'Male', spouse_gender: 'Female' }, form, {});
  assert.equal(couple.spouse_gender, 'Female');
});

test('organ donation and the date of birth reach Clio unchanged', () => {
  const p = buildClioPayload({ client_name: 'Test Client', organ_donation: 'Not available', client_date_of_birth: '1970-03-12' }, form, {});
  assert.equal(p.funeral_organ_donation, 'Not available');
  assert.equal(p.client_date_of_birth, '1970-03-12');
});

test('new intake answers become their own keys', () => {
  const p = buildClioPayload(
    {
      client_name: 'Test Client',
      doc_tt: 'on',
      has_tt: 'Yes',
      tt_beneficiaries: 'Test Child-One',
      preferred_meeting_date_2: '2026-10-20',
      remains_place_choice: 'Specific place',
      remains_place: 'Test Cemetery',
      vehicle: [{ 'Make and model': 'Test Car', 'Estimated value': '10000' }],
      investment_property: [{ Address: '3 Test Road', 'Tenancy type': 'Tenants in common', 'Estimated value': '650000' }],
      documents_to_bring: ['Photo ID'],
    },
    form,
    {},
  );
  assert.match(p.documents_required, /• Testamentary Trust/);
  assert.equal(p.wants_testamentary_trust, 'Yes');
  assert.equal(p.testamentary_trust_for, 'Test Child-One');
  assert.equal(p.preferred_meeting_date_2, '2026-10-20');
  assert.equal(p.funeral_remains_place, 'Test Cemetery');
  assert.equal(p.assets_vehicles, 'Motor Vehicles:\n• Test Car - 10000');
  assert.equal(p.assets_investment_property, 'Investment Properties:\n• 3 Test Road (Tenants in common) - $650000');
  assert.equal(p.assets_smsf, '');
  assert.equal(p.documents_to_bring, '• Photo ID');
});
