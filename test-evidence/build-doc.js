const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, ShadingType, AlignmentType, BorderStyle } = require('docx');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('results.json', 'utf8'));

const INK = '1C1715', CRIM = 'A81729', PASS = '2A6B4A', SOFT = '6B615D';
const W = 9360, C1 = 1800, C2 = 7560;

const p = (text, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, before: o.before ?? 0 },
  alignment: o.align,
  border: o.rule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E6DED9' } } : undefined,
  children: [new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size ?? 20,
                           color: o.color ?? INK, font: o.mono ? 'Consolas' : 'Calibri' })],
});

const cell = (text, o = {}) => new TableCell({
  width: { size: o.w, type: WidthType.DXA },
  shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: String(text).split('\n').map(line => new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: line, bold: o.bold, size: 18,
                             color: o.color ?? INK, font: o.mono ? 'Consolas' : 'Calibri' })],
  })),
});

const kv = rows => new Table({
  width: { size: W, type: WidthType.DXA },
  columnWidths: [C1, C2],
  rows: rows.map(([k, v, o = {}]) => new TableRow({ children: [
    cell(k, { w: C1, bold: true, color: SOFT, shade: 'FBF8F6' }),
    cell(v, { w: C2, mono: o.mono, color: o.color }),
  ]})),
});

const kids = [];
kids.push(p('ST IVES LAW  ·  QA EVIDENCE LOG', { bold: true, size: 16, color: CRIM, after: 60 }));
kids.push(new Paragraph({ spacing: { after: 100 },
  children: [new TextRun({ text: 'Stages 1–2 — Lead creation and qualification', bold: true, size: 40, color: INK, font: 'Calibri' })] }));
kids.push(p('Every case below was executed against the live production site and then verified independently in the database, rather than relying on the success message shown in the interface.',
  { color: SOFT, after: 200, rule: true }));

kids.push(p('Run details', { bold: true, size: 26, before: 240, after: 120 }));
kids.push(kv([
  ['Environment', data.environment],
  ['Signed in as', data.tester],
  ['Date', data.date],
  ['Stage', data.stage],
]));

const passed = data.cases.filter(c => c.result === 'PASS').length;
kids.push(p('Result summary', { bold: true, size: 26, before: 320, after: 120 }));
kids.push(new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [1200, 5760, 2400],
  rows: [
    new TableRow({ children: [
      cell('Case', { w: 1200, bold: true, color: 'FFFFFF', shade: INK }),
      cell('What was tested', { w: 5760, bold: true, color: 'FFFFFF', shade: INK }),
      cell('Result', { w: 2400, bold: true, color: 'FFFFFF', shade: INK }),
    ]}),
    ...data.cases.map(c => new TableRow({ children: [
      cell(c.id, { w: 1200, bold: true, mono: true }),
      cell(c.name, { w: 5760 }),
      cell(c.result, { w: 2400, bold: true, color: c.result === 'PASS' ? PASS : CRIM, shade: c.result === 'PASS' ? 'E6F0EA' : 'F6E9EB' }),
    ]})),
  ],
}));
const failed = data.cases.length - passed;
kids.push(p(failed
  ? `${passed} of ${data.cases.length} cases passed. ${failed} failed — see TC-2.2 and the blocker under Observations.`
  : `${passed} of ${data.cases.length} cases passed. No defects found.`,
  { bold: true, color: failed ? CRIM : PASS, before: 140, after: 240 }));

kids.push(p('Cases in detail', { bold: true, size: 26, before: 320, after: 160 }));
for (const c of data.cases) {
  kids.push(p(`${c.id} — ${c.name}`, { bold: true, size: 24, color: CRIM, before: 260, after: 100 }));
  const rows = [];
  if (c.steps) rows.push(['Steps taken', c.steps]);
  if (c.ui) rows.push(['Seen in the app', c.ui]);
  if (c.db) rows.push(['Verified in database', c.db, { mono: true }]);
  if (c.evidence) rows.push(['Evidence', c.evidence]);
  rows.push(['Result', c.result, { color: c.result === 'PASS' ? PASS : CRIM }]);
  kids.push(kv(rows));
  if (c.verdict) kids.push(p(c.verdict, { italics: true, color: SOFT, before: 100, after: 160 }));
}

kids.push(p('Observations', { bold: true, size: 26, before: 400, after: 100 }));
kids.push(p('None of these are defects. They are things worth knowing before someone else tests or debugs this area.',
  { color: SOFT, after: 160 }));
for (const o of data.observations) {
  kids.push(p(`${o.title}  (${o.severity})`, { bold: true, size: 21, before: 180, after: 60 }));
  kids.push(p(o.detail, { color: SOFT, after: 120 }));
}

kids.push(p('Note on screenshots', { bold: true, size: 26, before: 400, after: 100 }));
kids.push(p('Screenshots of every step were captured and are visible in the working session transcript. They could not be embedded here: the browser automation runs inside the tester’s own Chrome, so the image files are not reachable from the environment that builds this document. The database output quoted under each case is the stronger evidence in any event — it shows the stored record itself rather than a rendering of it.',
  { color: SOFT, after: 200 }));

const doc = new Document({
  creator: 'St Ives Law QA',
  title: 'QA Evidence Log — Stages 1-2',
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 },
                                     margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
               children: kids }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync('QA-Evidence-Stages-1-2.docx', b); console.log('written', b.length, 'bytes'); });
