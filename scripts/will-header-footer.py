"""
Give the will precedents the firm's header and footer (CR 2026-10-14, items 18-21).

    python3 scripts/will-header-footer.py            # rewrite the 12 will precedents in place
    python3 scripts/will-header-footer.py --check    # report only, change nothing

Every will precedent has two sections: the cover (ending at the "Ref:" line)
and the body. This replaces every header and footer part with four new ones:

  cover header   WILL OF <NAME>                      (no page number)
  cover footer   empty                               (no signature footer)
  body header    WILL OF <NAME> ............ Page X of Y   (X and Y bold)
  body footer    left:  signature line, Testator/Testatrix, Date ____/____/____
                 right: executor's signature line and printed name,
                        Witness 1, Witness 2

The name is the template's own merge field (<< Matter.Client.Name >> in the
Individual precedents, << Matter.Relationships.Mr.Name >> in the Couple ones,
whichever the "Last Will of" title uses) in a run formatted as all capitals,
so it prints in capitals both from our merge and from Clio's own. "Y" is
SECTIONPAGES: the body is the last section, so the count excludes the cover
and numbering starts at 1 on the first body page (pgNumType start=1 is
already set on the body section).

The Testator/Testatrix label is the merge field << Will.TestatorLabel >>,
which api/generate-document.ts fills from the client's gender (Testator when
the gender is unknown). The same field replaces the word "Testator" in the
body wherever it names the will-maker ("Testator means ...", "Signature of
Testator", the trust clauses). The bracketed drafting notes ("[#if Testator
wishes ...]") are instructions to the drafter and are left alone. His/her
pronouns are not touched (PENDING: Sarah).

The executor block in the footer sits between a bookmark named
ExecutorFooter; api/_lib/document-processor.ts drops it when
WILL_FOOTER_SHOWS_EXECUTOR is false (PENDING: Ces to confirm).

Idempotent: a precedent that already has the new parts is rebuilt the same
way. Every << >> merge field present before must still be present after; the
script refuses to write otherwise.
"""
import html
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / 'api' / 'templates'

WILLS = [
    f'{kind} - {scenario} (Clio).docx'
    for kind in [
        'Simple Will',
        'Single TT Will',
        'Multi TT Will',
        'Single TT Will (with Foreign Persons Excluded Trust)',
        'Multi TT Will (with Foreign Persons Excluded Trust)',
    ]
    for scenario in ['Individual', 'Couple']
]
# There is no "Simple Will (with Foreign Persons Excluded Trust)": a simple
# will has no testamentary trust to exclude foreign persons from. 10 files.

LABEL_FIELD = '&lt;&lt; Will.TestatorLabel &gt;&gt;'
EXECUTOR_FIELD = '&lt;&lt; Matter.CustomField.InitialExecutor &gt;&gt;'
NS = (
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
)
HDR_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'
FTR_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'
HDR_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header'
FTR_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer'

PARTS = {
    # rId: (part name, kind)
    'rIdWillHdrCover': ('header1.xml', 'header'),
    'rIdWillHdrBody': ('header2.xml', 'header'),
    'rIdWillFtrCover': ('footer1.xml', 'footer'),
    'rIdWillFtrBody': ('footer2.xml', 'footer'),
}

SIZE = '<w:sz w:val="18"/><w:szCs w:val="18"/>'  # 9 pt
LINE = '_' * 34


def run(text, bold=False, caps=False):
    rpr = ('<w:b/><w:bCs/>' if bold else '') + ('<w:caps/>' if caps else '') + SIZE
    return f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{text}</w:t></w:r>'


def field(instr, bold):
    rpr = f'<w:rPr>{"<w:b/><w:bCs/>" if bold else ""}{SIZE}</w:rPr>'
    return (
        f'<w:r>{rpr}<w:fldChar w:fldCharType="begin"/></w:r>'
        f'<w:r>{rpr}<w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
        f'<w:r>{rpr}<w:fldChar w:fldCharType="separate"/></w:r>'
        f'<w:r>{rpr}<w:t>1</w:t></w:r>'
        f'<w:r>{rpr}<w:fldChar w:fldCharType="end"/></w:r>'
    )


def para(content, before=0, tab=None, keep=False):
    tabs = f'<w:tabs><w:tab w:val="right" w:pos="{tab}"/></w:tabs>' if tab else ''
    keep_next = '<w:keepNext/>' if keep else ''
    return (
        f'<w:p><w:pPr>{keep_next}{tabs}<w:spacing w:before="{before}" w:after="0" w:line="240" w:lineRule="auto"/>'
        f'<w:jc w:val="left"/><w:rPr>{SIZE}</w:rPr></w:pPr>{content}</w:p>'
    )


def will_of(name_field):
    return run('WILL OF ') + run(name_field, caps=True)


def header_cover(name_field):
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr {NS}>{para(will_of(name_field))}</w:hdr>'


def header_body(name_field, width):
    content = (
        will_of(name_field)
        + '<w:r><w:rPr>' + SIZE + '</w:rPr><w:tab/></w:r>'
        + run('Page ') + field('PAGE', True) + run(' of ') + field('SECTIONPAGES', True)
    )
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr {NS}>{para(content, tab=width)}</w:hdr>'


def footer_cover():
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr {NS}>{para("")}</w:ftr>'


def footer_body(width):
    half = width // 2
    no_borders = ''.join(
        f'<w:{side} w:val="nil"/>' for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    )
    left = (
        para(run(LINE), before=360)
        + para(run(LABEL_FIELD))
        + para(run('Date ____/____/____'), before=160)
    )
    # The executor's printed name and signature line. Wrapped in the
    # ExecutorFooter bookmark so document-processor can remove it in one
    # change. TODO(PENDING: Ces to confirm) whether the executor signs at all.
    executor = (
        '<w:p><w:pPr><w:spacing w:before="360" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr>' + SIZE + '</w:rPr></w:pPr>'
        '<w:bookmarkStart w:id="9001" w:name="ExecutorFooter"/>' + run(LINE) + '</w:p>'
        '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:rPr>' + SIZE + '</w:rPr></w:pPr>'
        + run(EXECUTOR_FIELD) + '<w:bookmarkEnd w:id="9001"/></w:p>'
    )
    right = (
        executor
        + para(run(LINE), before=360)
        + para(run('Witness 1'))
        + para(run(LINE), before=360)
        + para(run('Witness 2'))
    )

    def cell(content):
        return f'<w:tc><w:tcPr><w:tcW w:w="{half}" w:type="dxa"/></w:tcPr>{content}</w:tc>'

    table = (
        f'<w:tbl><w:tblPr><w:tblW w:w="{half * 2}" w:type="dxa"/><w:tblBorders>{no_borders}</w:tblBorders>'
        '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
        '<w:tblLook w:val="0000"/></w:tblPr>'
        f'<w:tblGrid><w:gridCol w:w="{half}"/><w:gridCol w:w="{half}"/></w:tblGrid>'
        f'<w:tr>{cell(left)}{cell(right)}</w:tr></w:tbl>'
    )
    # A paragraph must follow a table in a footer.
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr {NS}>{table}{para("")}</w:ftr>'


def text_of(xml):
    return html.unescape(re.sub(r'<[^>]+>', '', xml))


def merge_fields(parts):
    found = set()
    for xml in parts:
        for m in re.finditer(r'<<\s*([^<>]+?)\s*>>', text_of(xml)):
            found.add(re.sub(r'\s+', '', m.group(1)))
    return found


def relabel_testator(doc):
    """Swap the word Testator for the label field, outside the drafting notes."""
    count = 0

    def fix_paragraph(m):
        nonlocal count
        p = m.group(0)
        if '[#' in text_of(p):
            return p

        def fix_text(t):
            nonlocal count
            new, n = re.subn(r'\bTestator\b', LABEL_FIELD, t.group(2))
            count += n
            return t.group(1) + new + t.group(3)

        return re.sub(r'(<w:t(?:\s[^>]*)?>)([^<]*)(</w:t>)', fix_text, p)

    doc = re.sub(r'<w:p\b(?:(?!<w:p\b).)*?</w:p>', fix_paragraph, doc, flags=re.S)
    return doc, count


def rewrite_sectpr(sect, cover):
    hdr = 'rIdWillHdrCover' if cover else 'rIdWillHdrBody'
    ftr = 'rIdWillFtrCover' if cover else 'rIdWillFtrBody'
    sect = re.sub(r'<w:(header|footer)Reference\b[^>]*/>', '', sect)
    sect = sect.replace('<w:titlePg/>', '')
    refs = ''.join(f'<w:headerReference w:type="{t}" r:id="{hdr}"/>' for t in ['default', 'even', 'first'])
    refs += ''.join(f'<w:footerReference w:type="{t}" r:id="{ftr}"/>' for t in ['default', 'even', 'first'])
    return re.sub(r'(<w:sectPr\b[^>]*>)', lambda m: m.group(1) + refs, sect, count=1)


def transform(path, write):
    with zipfile.ZipFile(path) as z:
        entries = [(info, z.read(info.filename)) for info in z.infolist()]
    files = {info.filename: data for info, data in entries}
    doc = files['word/document.xml'].decode('utf8')
    old_hf = [n for n in files if re.match(r'word/(header|footer)\d*\.xml$', n)]
    before = merge_fields([doc] + [files[n].decode('utf8') for n in old_hf])

    title = re.search(r'Last Will of\s*<<\s*([\w.]+)\s*>>', text_of(re.sub(r'</w:p>', '\n', doc)))
    if not title:
        raise SystemExit(f'{path.name}: no "Last Will of << ... >>" title found')
    name_field = f'&lt;&lt; {title.group(1)} &gt;&gt;'

    sects = list(re.finditer(r'<w:sectPr\b.*?</w:sectPr>', doc, re.S))
    if len(sects) != 2:
        raise SystemExit(f'{path.name}: expected 2 sections (cover, body), found {len(sects)}')
    body_sect = sects[1].group(0)
    pg_w = int(re.search(r'<w:pgSz w:w="(\d+)"', body_sect).group(1))
    mar = re.search(r'<w:pgMar\b[^>]*>', body_sect).group(0)
    width = pg_w - int(re.search(r'w:left="(\d+)"', mar).group(1)) - int(re.search(r'w:right="(\d+)"', mar).group(1))
    if 'w:start="1"' not in (re.search(r'<w:pgNumType[^>]*>', body_sect) or [''])[0]:
        raise SystemExit(f'{path.name}: body section does not restart numbering at 1')

    # Sections, last first so offsets stay valid.
    for i in (1, 0):
        m = list(re.finditer(r'<w:sectPr\b.*?</w:sectPr>', doc, re.S))[i]
        doc = doc[: m.start()] + rewrite_sectpr(m.group(0), cover=(i == 0)) + doc[m.end():]

    doc, relabelled = relabel_testator(doc)

    new_parts = {
        'word/header1.xml': header_cover(name_field),
        'word/header2.xml': header_body(name_field, width),
        'word/footer1.xml': footer_cover(),
        'word/footer2.xml': footer_body(width),
    }

    after = merge_fields([doc] + list(new_parts.values()))
    lost = before - after
    if lost:
        raise SystemExit(f'{path.name}: merge fields would be lost: {sorted(lost)}')

    rels = files['word/_rels/document.xml.rels'].decode('utf8')
    rels = re.sub(r'<Relationship\b[^>]*Type="[^"]*/(header|footer)"[^>]*/>', '', rels)
    rels = rels.replace(
        '</Relationships>',
        ''.join(
            f'<Relationship Id="{rid}" Type="{HDR_REL if kind == "header" else FTR_REL}" Target="{name}"/>'
            for rid, (name, kind) in PARTS.items()
        )
        + '</Relationships>',
    )
    ct = files['[Content_Types].xml'].decode('utf8')
    ct = re.sub(r'<Override PartName="/word/(header|footer)\d*\.xml"[^>]*/>', '', ct)
    ct = ct.replace(
        '</Types>',
        ''.join(
            f'<Override PartName="/word/{name}" ContentType="{HDR_CT if kind == "header" else FTR_CT}"/>'
            for name, kind in PARTS.values()
        )
        + '</Types>',
    )

    report = (
        f'{path.name}: name field {title.group(1)}, text width {width}, '
        f'{relabelled} "Testator" relabelled, removed {len(old_hf)} header/footer parts, '
        f'merge fields added {sorted(after - before)}'
    )
    if not write:
        return report

    out = {}
    for info, data in entries:
        n = info.filename
        if n in old_hf or re.match(r'word/_rels/(header|footer)\d*\.xml\.rels$', n):
            continue
        out[n] = data
    out['word/document.xml'] = doc.encode('utf8')
    out['word/_rels/document.xml.rels'] = rels.encode('utf8')
    out['[Content_Types].xml'] = ct.encode('utf8')
    for n, xml in new_parts.items():
        out[n] = xml.encode('utf8')

    tmp = path.with_suffix('.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', out.pop('[Content_Types].xml'))
        for n, data in out.items():
            z.writestr(zipfile.ZipInfo(n, date_time=(1980, 1, 1, 0, 0, 0)), data, zipfile.ZIP_DEFLATED)
    tmp.replace(path)
    return report


if __name__ == '__main__':
    write = '--check' not in sys.argv
    for name in WILLS:
        print(transform(TEMPLATES / name, write))
