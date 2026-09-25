#!/usr/bin/env python3
"""
Convert the firm's LEAP-coded EPA and ACD precedents into Clio-coded ones.

The firm sent these two statutory forms as LEAP templates: every variable is a
LEAP content control (<w:sdt> with a dataBinding into LEAP's own customXml),
which this app's merge engine cannot see -- it only substitutes << Name >>
text. Left alone, both forms generate blank.

This unwraps each LEAP control, keeping the paragraph/run structure and its
formatting exactly as-is, and writes a << Matter... >> token into the run where
LEAP's value used to go. Non-LEAP controls -- the organ-donation checkboxes in
ACD Part 3g -- are left untouched.

Run again whenever the firm sends a fresh copy of either statutory form --
Form P2 is reissued by the Registrar-General and the ACD by SA Health, and
both arrive as LEAP templates. The outputs are committed to api/templates and
public/templates.

    python3 scripts/convert-leap-precedent.py [source-directory]
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

# Where the firm's LEAP originals sit. Override with the first CLI argument:
#   python3 scripts/convert-leap-precedent.py ~/Downloads
SRC = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path.home() / "Downloads"

# Anchored to the repo, so running this from anywhere puts the precedents in
# the two directories generateWillFromTemplate actually searches.
ROOT = Path(__file__).resolve().parent.parent
DESTS = [ROOT / "api" / "templates", ROOT / "public" / "templates"]

SDT = re.compile(r"<w:sdt>.*?</w:sdt>", re.S)
PLACEHOLDER_RSTYLE = re.compile(r'<w:rStyle w:val="PlaceholderText"\s*/>')
WT = re.compile(r"<w:t(?:\s[^>]*)?/>|<w:t(?:\s[^>]*)?>.*?</w:t>", re.S)
PARA = re.compile(r"<w:p(?:\s[^>]*)?>.*?</w:p>", re.S)


def tok(name: str) -> str:
    """A merge token as it must appear inside <w:t> -- angle brackets escaped."""
    return f"&lt;&lt;{name}&gt;&gt;"


def plain(xml: str) -> str:
    return re.sub(r"<[^>]+>", "", xml)


def set_run_text(inner: str, token: str) -> str:
    """Write `token` into the first <w:t> of `inner`; blank any others.

    LEAP leaves its own rendered remnants behind -- an unfilled address comes
    through as the literal ", ,   " -- so the other runs are emptied rather
    than kept.
    """
    seen = [0]

    def repl(_m):
        seen[0] += 1
        if seen[0] == 1:
            return f'<w:t xml:space="preserve">{token}</w:t>'
        return '<w:t xml:space="preserve"></w:t>'

    out = WT.sub(repl, inner)
    if seen[0] == 0:
        raise SystemExit(f"no <w:t> to write into: {inner[:200]}")
    return out


def unwrap_leap(xml: str, mapping: dict, report: list) -> str:
    """Replace every LEAP content control with its own contents.

    A mapping value of None means "unwrap but keep the text" -- used for the
    agent-code block, which already reads St Ives Law / IVESP correctly. A list
    means the alias appears more than once and each occurrence takes a
    different token, in document order: the EPA's conditions box has an
    overflow "(continued)" twin, and merging the same value into both would
    print the conditions twice.
    """
    seen_alias: dict = {}

    def repl(m):
        blk = m.group(0)
        # Word's own checkbox controls (ACD Part 3g organ donation) are not
        # LEAP's and must survive: the client ticks them by hand.
        if "LEAPField" not in blk and "LEAPConditionalField" not in blk:
            return blk

        alias_m = re.search(r'<w:alias w:val="([^"]*)"', blk)
        alias = alias_m.group(1) if alias_m else None
        content = re.search(r"<w:sdtContent>(.*)</w:sdtContent>", blk, re.S)
        if not content:
            raise SystemExit(f"LEAP control with no sdtContent: {alias}")

        inner = content.group(1)
        if alias not in mapping:
            raise SystemExit(f"unmapped LEAP control: {alias!r}")

        token = mapping[alias]
        if isinstance(token, list):
            nth = seen_alias.get(alias, 0)
            seen_alias[alias] = nth + 1
            if nth >= len(token):
                raise SystemExit(f"{alias} appears more often than it has tokens")
            token = token[nth]
        if token is not None:
            inner = set_run_text(inner, token)
        # The grey "click here to enter text" styling would otherwise follow
        # the merged value into the signed document.
        inner = PLACEHOLDER_RSTYLE.sub("", inner)
        report.append((alias, token))
        return inner

    return SDT.sub(repl, xml)


def replace_para_span(xml: str, start_text: str, end_text: str, token: str) -> str:
    """Collapse a run of hard-coded paragraphs into one carrying `token`.

    Used for ACD Part 4, where the supplied template hard-codes a binding
    refusal of life-prolonging treatment as ordinary body text. That has to be
    the client's choice, not the template's, so the whole block becomes a
    placeholder the firm fills per client.
    """
    paras = [(m.start(), m.end(), plain(m.group(0))) for m in PARA.finditer(xml)]
    first = next((i for i, p in enumerate(paras) if start_text in p[2]), None)
    last = next((i for i, p in enumerate(paras) if end_text in p[2]), None)
    if first is None or last is None or last < first:
        raise SystemExit(f"could not locate paragraph span {start_text!r}..{end_text!r}")

    # Reuse the first paragraph's own properties so the replacement sits on the
    # form exactly where the original text did.
    head = xml[paras[first][0]:paras[first][1]]
    ppr = re.search(r"<w:pPr>.*?</w:pPr>", head, re.S)
    rpr = re.search(r"<w:rPr>.*?</w:rPr>", head[ppr.end():] if ppr else head, re.S)
    new_para = (
        "<w:p>"
        + (ppr.group(0) if ppr else "")
        + "<w:r>"
        + (rpr.group(0) if rpr else "")
        + f'<w:t xml:space="preserve">{token}</w:t>'
        + "</w:r></w:p>"
    )
    return xml[:paras[first][0]] + new_para + xml[paras[last][1]:]


VLINE = re.compile(r'<v:line[^>]*?from="([^"]*)"[^>]*?to="([^"]*)"')


def strip_drawn_z_marks(xml: str) -> str:
    """Remove the hand-drawn 'Z' cross-outs baked into the supplied ACD.

    The form tells the *person* to "cross out this section by placing a large
    'Z'" wherever they are not using an optional part. In the copy the firm
    sent, all twelve of those sections already carry one: a VML group of three
    lines -- top rule, diagonal, bottom rule -- drawn over the box. Someone
    crossed out a real client's form in LEAP and saved it back as the template.

    Left in, every generated directive arrives with its health conditions, all
    of Parts 3a-3f, the interpreter statement, and -- worst -- the first
    preferred Substitute Decision-Maker's details and their Part 5 acceptance
    block struck through, while the merge writes that same person's name into
    the boxes underneath. A directive that appoints someone and crosses them
    out in the same breath is not one the firm can let a client sign.

    Each Z is stored twice, as Word always stores a shape: a DrawingML
    <w:drawing> for modern readers and a VML <w:pict> fallback for old ones,
    both inside one <mc:AlternateContent>. Removing only the fallback leaves
    the Z on the page, so the whole AlternateContent block goes -- classified
    from the VML twin, whose from="x,y" to="x,y" coordinates say plainly which
    line is the diagonal.

    Only the Z groups go. The form's own graphics -- the Government of South
    Australia masthead, the PART banners -- carry no diagonal and are left
    alone, as is the lone single-line rule that is part of the layout.
    """
    def coord(pair: str):
        # VML writes either bare numbers or values carrying a unit ("-42051pt").
        # x and y always share a unit, so the suffix can go before comparing.
        out = []
        for v in pair.split(",")[:2]:
            m = re.match(r"\s*(-?[\d.]+)", v.strip())
            if not m:
                return None
            out.append(float(m.group(1)))
        return out if len(out) == 2 else None

    def is_z(blk: str) -> bool:
        for frm, to in VLINE.findall(blk):
            a, b = coord(frm), coord(to)
            if not a or not b:
                continue
            # A rule runs flat; the Z's diagonal drops across the whole box.
            if abs(b[1] - a[1]) / (abs(b[0] - a[0]) or 1) > 0.05:
                return True
        return False

    removed = [0]

    def repl(m):
        if is_z(m.group(0)):
            removed[0] += 1
            return ""
        return m.group(0)

    out = re.sub(r"<mc:AlternateContent>.*?</mc:AlternateContent>", repl, xml, flags=re.S)
    if removed[0] != 12:
        raise SystemExit(
            f"expected 12 'Z' cross-outs in the supplied ACD, removed {removed[0]}"
        )
    print(f"    removed {removed[0]} pre-drawn 'Z' cross-outs")
    return out


def strip_leap_taskpane(zin: zipfile.ZipFile, name: str, data: bytes) -> bytes:
    """Drop the LEAP web-extension wiring so Word stops trying to load it."""
    if name == "[Content_Types].xml":
        text = data.decode("utf8")
        text = re.sub(r"<Override PartName=\"/word/webextensions/[^\"]*\"[^/]*/>", "", text)
        return text.encode("utf8")
    if name == "word/_rels/document.xml.rels":
        text = data.decode("utf8")
        text = re.sub(r"<Relationship[^>]*webextensions/taskpanes\.xml\"[^>]*/>", "", text)
        return text.encode("utf8")
    return data


def convert(src: Path, out: Path, mapping: dict, surgery=None) -> list:
    report: list = []
    with zipfile.ZipFile(src) as zin:
        items = [(i, zin.read(i.filename)) for i in zin.infolist()]

    # Build beside the target and move into place only on success. A crash
    # part-way through used to leave a truncated archive sitting in
    # api/templates, which the generator happily picks up and produces an
    # unopenable document from.
    tmp = out.with_suffix(".docx.partial")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for info, data in items:
            name = info.filename
            if name.startswith("word/webextensions/"):
                continue  # LEAP's add-in pane; nothing references it once removed
            if name == "word/document.xml":
                xml = data.decode("utf8")
                if surgery:
                    xml = surgery(xml)
                xml = unwrap_leap(xml, mapping, report)
                if "<w:sdt>" in xml and "LEAPField" in xml:
                    raise SystemExit("LEAP controls survived the conversion")
                data = xml.encode("utf8")
            else:
                data = strip_leap_taskpane(zin, name, data)
            zout.writestr(info, data)
    tmp.replace(out)
    return report


# ---------------------------------------------------------------------------
# EPA -- Lands Titles Office Form P2. One donor per instrument, so a couple
# gets two of these (the generator already produces one document per spouse).
# ---------------------------------------------------------------------------
EPA_MAP = {
    # Already reads "St Ives Law / IVESP" -- the firm's own LTO agent code.
    "c_AgentCode": None,
    "c_Donors": f"{tok('Matter.Client.Name')} of {tok('Matter.Client.Address')}",
    "c_Donee": tok("Matter.CustomField.EpaDonee"),
    # LEAP called this "DoneesPart2Wording"; on the form it is simply the
    # second line of the DONEE(S) box.
    "c_DoneesPart2Wording": tok("Matter.CustomField.EpaDoneeSecond"),
    # "... TO BE MY ATTORNEY(S)" -- jointly / severally / jointly and severally.
    "co_Attorney": tok("Matter.CustomField.EpaDoneeCapacity"),
    # The supplied template had already collapsed this conditional to the
    # immediate-effect branch, with no way to choose the alternative. As a
    # placeholder the firm sets it per client.
    "LEAPConditionalField-co_Effect": tok("Matter.CustomField.EpaCommencement"),
    # Two boxes on the form: the main one and its "(continued)" overflow.
    "c_ConditionLimitationsExclusions": [
        tok("Matter.CustomField.EpaConditions"),
        tok("Matter.CustomField.EpaConditionsContinued"),
    ],
}

# ---------------------------------------------------------------------------
# ACD -- Advance Care Directives Act 2013 (SA) form, Parts 1-8.
# ---------------------------------------------------------------------------
ACD_MAP = {}
for n, leap in ((1, ""), (2, "Sec"), (3, "3rd"), (4, "4th")):
    for leap_field, clio_field in (
        ("Name", "Name"),
        ("DOB", "Dob"),
        ("Address", "Address"),
        ("Phone", "Phone"),
    ):
        ACD_MAP[f"c_AppointSubst{leap}{leap_field}"] = tok(
            f"Matter.CustomField.AcdSdm{n}{clio_field}"
        )


def acd_surgery(xml: str) -> str:
    xml = replace_para_span(
        xml,
        "Pursuant to section 19 of the Act",
        "I DO HEREBY make the direction",
        tok("Matter.CustomField.AcdHealthCareRefusals"),
    )
    return strip_drawn_z_marks(xml)


JOBS = [
    (
        SRC / "Enduring power of attorney.docx",
        "Enduring Power of Attorney - Individual (Clio).docx",
        EPA_MAP,
        None,
    ),
    (
        SRC / "Advance Care Directive Form.docx",
        "Advance Care Directive - Individual (Clio).docx",
        ACD_MAP,
        acd_surgery,
    ),
]

if __name__ == "__main__":
    for dest in DESTS:
        dest.mkdir(parents=True, exist_ok=True)

    for src, out_name, mapping, surgery in JOBS:
        primary = DESTS[0] / out_name
        report = convert(src, primary, mapping, surgery)
        for dest in DESTS[1:]:
            shutil.copyfile(primary, dest / out_name)
        print(f"\n{out_name}")
        print(f"  from {src.name}  ->  {len(report)} LEAP controls converted")
        for alias, token in report:
            shown = token.replace("&lt;", "<").replace("&gt;", ">") if token else "(text kept)"
            print(f"    {alias:<36} -> {shown}")
