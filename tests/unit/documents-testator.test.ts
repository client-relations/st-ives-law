/**
 * The will precedents' header, footer and Testator/Testatrix label
 * (CR 2026-10-14 items 18-21, 23). Offline: fetch throws.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';

globalThis.fetch = (async () => {
  throw new Error('network blocked in tests');
}) as typeof fetch;

let buildTemplateVariables: (body: any) => Record<string, string>;
let testatorLabel: (gender: unknown) => string;
let cleanPersonName: (name: string) => string;
let generateWillFromTemplate: typeof import('../../api/_lib/document-processor').generateWillFromTemplate;
let removeExecutorFooter: (xml: string) => string;

before(async () => {
  ({ buildTemplateVariables, testatorLabel } = await import('../../api/generate-document'));
  ({ cleanPersonName } = await import('../../api/_lib/clio-client'));
  ({ generateWillFromTemplate, removeExecutorFooter } = await import('../../api/_lib/document-processor'));
});

const TEMPLATES = join(__dirname, '..', '..', 'api', 'templates');
const WILLS = ['Simple Will', 'Single TT Will', 'Multi TT Will', 'Single TT Will (with Foreign Persons Excluded Trust)', 'Multi TT Will (with Foreign Persons Excluded Trust)']
  .flatMap((kind) => ['Individual', 'Couple'].map((s) => `${kind} - ${s} (Clio).docx`));

const text = (xml: string) =>
  xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

/** Merge a will offline and return its body, header and footer text. */
async function generate(type: 'simple_will' | 'single_tt_will' | 'multi_tt_will', scenario: 'individual' | 'couple', vars: Record<string, string>) {
  const log = console.log;
  console.log = () => {};
  try {
    const variables = buildTemplateVariables({ templateType: type, scenario, client_name: vars['Matter.Client.Name'], ...vars });
    const zip = await JSZip.loadAsync(await generateWillFromTemplate(type, scenario, variables, 'docx'));
    const read = async (name: string) => (await zip.file(name)?.async('text')) ?? '';
    return {
      variables,
      body: text(await read('word/document.xml')),
      coverHeader: await read('word/header1.xml'),
      bodyHeader: await read('word/header2.xml'),
      coverFooter: text(await read('word/footer1.xml')),
      bodyFooter: text(await read('word/footer2.xml')),
    };
  } finally {
    console.log = log;
  }
}

test('testatorLabel: Testatrix only for Female, Testator otherwise', () => {
  assert.equal(testatorLabel('Female'), 'Testatrix');
  assert.equal(testatorLabel(' female '), 'Testatrix');
  assert.equal(testatorLabel('Male'), 'Testator');
  assert.equal(testatorLabel(''), 'Testator');
  assert.equal(testatorLabel(undefined), 'Testator');
  assert.equal(testatorLabel(null), 'Testator');
});

test('buildTemplateVariables reads the will-maker gender from the Clio field, defaulting to Testator', () => {
  assert.equal(buildTemplateVariables({ 'Matter.CustomField.ClientGender': 'Female' })['Will.TestatorLabel'], 'Testatrix');
  assert.equal(buildTemplateVariables({ 'Matter.CustomField.ClientGender': 'Male' })['Will.TestatorLabel'], 'Testator');
  assert.equal(buildTemplateVariables({})['Will.TestatorLabel'], 'Testator');
  assert.equal(buildTemplateVariables({ client_gender: 'Female' })['Will.TestatorLabel'], 'Testatrix');
});

test('a couple: the swapped version reads the spouse gender', () => {
  const variables = { 'Matter.CustomField.ClientGender': 'Male', 'Matter.CustomField.SpouseGender': 'Female' };
  const swapped = {
    ...variables,
    'Matter.CustomField.ClientGender': variables['Matter.CustomField.SpouseGender'],
    'Matter.CustomField.SpouseGender': variables['Matter.CustomField.ClientGender'],
  };
  assert.equal(buildTemplateVariables(variables)['Will.TestatorLabel'], 'Testator');
  assert.equal(buildTemplateVariables(swapped)['Will.TestatorLabel'], 'Testatrix');
});

test('cleanPersonName keeps the name and drops dates, stamps and Make tails', () => {
  assert.equal(cleanPersonName('Test Client'), 'Test Client');
  assert.equal(cleanPersonName('Test Client-Two'), 'Test Client-Two');
  assert.equal(cleanPersonName("Test O'Brien-Smith"), "Test O'Brien-Smith");
  assert.equal(cleanPersonName('Testa ZZ DOCTEST Single 14-Oct-2026-10-22-33'), 'Testa ZZ DOCTEST Single');
  assert.equal(cleanPersonName('Test Client 2026-10-14'), 'Test Client');
  assert.equal(cleanPersonName('Test Client 2026-10-14T05:55:42.000Z'), 'Test Client');
  assert.equal(cleanPersonName('Test Client 14/10/2026'), 'Test Client');
  assert.equal(cleanPersonName('Test Client (Engineer) - Single - Simple will - Client, Test'), 'Test Client');
  assert.equal(cleanPersonName('Mrs Test Client,'), 'Mrs Test Client');
});

test('the title, header and execution block print the bare name', async () => {
  const doc = await generate('simple_will', 'individual', { 'Matter.Client.Name': 'Test Client 14-Oct-2026-10-22-33' });
  assert.equal(doc.variables['Matter.Client.Name'], 'Test Client');
  assert.match(doc.body, /Last Will of Test Client\n/);
  assert.doesNotMatch(doc.body + text(doc.bodyHeader), /2026/);
});

test('female single: Testatrix in the body and footer, no placeholder left', async () => {
  const doc = await generate('single_tt_will', 'individual', {
    'Matter.Client.Name': 'Test Female-Client',
    'Matter.CustomField.ClientGender': 'Female',
    'Matter.CustomField.InitialExecutor': 'Test Executor-One',
  });
  assert.match(doc.body, /Testatrix means Test Female-Client\./);
  assert.match(doc.body, /Signature of Testatrix/);
  assert.match(doc.body, /the Testatrix’s Residual Estate/);
  assert.doesNotMatch(doc.body, /Will\.TestatorLabel|\bTestator\b(?! wishes)/);
  assert.match(doc.bodyFooter, /^_+\nTestatrix\nDate ____\/____\/____\n_+\nTest Executor-One\n_+\nWitness 1\n_+\nWitness 2/);
});

test('missing gender: Testator, as before gender was collected', async () => {
  const doc = await generate('simple_will', 'individual', { 'Matter.Client.Name': 'Test Client' });
  assert.match(doc.body, /Testator means Test Client\./);
  assert.match(doc.bodyFooter, /\nTestator\n/);
  // The drafting notes are instructions to the drafter and keep their wording.
  assert.match(doc.body, /\[#if Testator wishes to benefit children\]/);
});

test('couple: header and label follow the will-maker of each version', async () => {
  const base = {
    'Matter.Client.Name': 'Test Husband',
    'Matter.Relationships.Mr.Name': 'Test Husband',
    'Matter.Relationships.Mrs.Name': 'Test Wife',
    'Matter.CustomField.ClientGender': 'Male',
    'Matter.CustomField.SpouseGender': 'Female',
  };
  const wife = await generate('multi_tt_will', 'couple', {
    ...base,
    'Matter.Client.Name': 'Test Wife',
    'Matter.Relationships.Mr.Name': 'Test Wife',
    'Matter.Relationships.Mrs.Name': 'Test Husband',
    'Matter.CustomField.ClientGender': 'Female',
    'Matter.CustomField.SpouseGender': 'Male',
  });
  assert.match(text(wife.bodyHeader), /^WILL OF Test Wife\tPage/);
  assert.match(wife.body, /Testatrix means Test Wife\./);
  const husband = await generate('multi_tt_will', 'couple', base);
  assert.match(text(husband.bodyHeader), /^WILL OF Test Husband\tPage/);
  assert.match(husband.body, /Testator means Test Husband\./);
});

test('header: WILL OF in capitals, Page X of Y bold on the body only, no firm name', async () => {
  const doc = await generate('simple_will', 'individual', { 'Matter.Client.Name': 'Test Client' });
  // Capitals come from the run's caps formatting, so Clio's own merge prints them too.
  assert.match(doc.bodyHeader, /<w:caps\/>[^]*?Test Client/);
  assert.match(doc.coverHeader, /<w:caps\/>[^]*?Test Client/);
  assert.doesNotMatch(doc.coverHeader, /PAGE/);
  assert.equal(doc.coverFooter.trim(), '');
  for (const field of ['PAGE', 'SECTIONPAGES']) {
    assert.match(doc.bodyHeader, new RegExp(`<w:r><w:rPr><w:b/>[^]*?<w:instrText xml:space="preserve"> ${field} </w:instrText>`));
  }
  assert.doesNotMatch(doc.coverHeader + doc.bodyHeader, /St Ives/i);
});

test('every will precedent: cover and body sections use the new parts, numbering restarts at 1', async () => {
  for (const name of WILLS) {
    const zip = await JSZip.loadAsync(readFileSync(join(TEMPLATES, name)));
    const doc = await zip.file('word/document.xml')!.async('text');
    const sects = doc.match(/<w:sectPr\b[^]*?<\/w:sectPr>/g) || [];
    assert.equal(sects.length, 2, name);
    for (const type of ['default', 'even', 'first']) {
      assert.match(sects[0], new RegExp(`headerReference w:type="${type}" r:id="rIdWillHdrCover"`), name);
      assert.match(sects[0], new RegExp(`footerReference w:type="${type}" r:id="rIdWillFtrCover"`), name);
      assert.match(sects[1], new RegExp(`headerReference w:type="${type}" r:id="rIdWillHdrBody"`), name);
      assert.match(sects[1], new RegExp(`footerReference w:type="${type}" r:id="rIdWillFtrBody"`), name);
    }
    assert.match(sects[1], /<w:pgNumType w:start="1"\/>/, name);
    const parts = Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)).sort();
    assert.deepEqual(parts, ['word/footer1.xml', 'word/footer2.xml', 'word/header1.xml', 'word/header2.xml'], name);
  }
});

test('the executor block comes out in one change', async () => {
  const doc = await generate('simple_will', 'individual', {
    'Matter.Client.Name': 'Test Client',
    'Matter.CustomField.InitialExecutor': 'Test Executor-One',
  });
  const zip = await JSZip.loadAsync(readFileSync(join(TEMPLATES, 'Simple Will - Individual (Clio).docx')));
  const footer = await zip.file('word/footer2.xml')!.async('text');
  const without = text(removeExecutorFooter(footer));
  assert.match(doc.bodyFooter, /Test Executor-One/);
  assert.doesNotMatch(without, /InitialExecutor/);
  assert.match(without, /^_+\n<< Will\.TestatorLabel >>\nDate ____\/____\/____\n_+\nWitness 1\n_+\nWitness 2/);
  assert.equal(removeExecutorFooter('<w:ftr><w:p/></w:ftr>'), '<w:ftr><w:p/></w:ftr>');
});
