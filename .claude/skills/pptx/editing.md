# Editing Existing Presentations

For modifying an existing .pptx or filling a corporate template. All *new*
content written during editing must follow [design.md](design.md) — but when
working inside a client's template, **the template's existing fonts, colors, and
layouts win**; design.md governs wording (action titles), content structure, and
what to avoid (the blacklist still applies to content you add).

---

## Reading & Analyzing

```bash
# Text content
python -m markitdown presentation.pptx

# Visual overview — render every slide to images
soffice --headless --convert-to pdf presentation.pptx
pdftoppm -jpeg -r 100 presentation.pdf slide    # slide-01.jpg, slide-02.jpg, ...
```

Review the images to understand layouts; use markitdown output to map text to
slides.

---

## Unpack / Pack

A .pptx is a zip of XML. Work on an unpacked copy:

```bash
# Unpack
mkdir unpacked && cd unpacked && unzip -o ../presentation.pptx && cd ..

# Pretty-print the XML you intend to edit (much easier to Edit reliably)
python3 - <<'EOF'
import glob, defusedxml.minidom as minidom
for f in glob.glob("unpacked/ppt/slides/slide*.xml") + ["unpacked/ppt/presentation.xml"]:
    pretty = minidom.parse(f).toprettyxml(indent="  ")
    lines = [l for l in pretty.splitlines() if l.strip()]
    open(f, "w", encoding="utf-8").write("\n".join(lines))
EOF

# Pack (after editing) — zip from INSIDE the directory, [Content_Types].xml at root
cd unpacked && rm -f ../output.pptx && zip -r -X ../output.pptx '[Content_Types].xml' _rels docProps ppt && cd ..

# Validate immediately: a successful PDF conversion proves the file opens
soffice --headless --convert-to pdf output.pptx
```

**XML parsing in Python:** use `defusedxml.minidom`, never
`xml.etree.ElementTree` (it corrupts namespace prefixes on write).

---

## Template-Based Workflow

1. **Analyze**: render thumbnails + markitdown (above). Identify which layout
   each template slide uses.
2. **Plan slide mapping**: for each content section, choose a template slide.
   Use varied layouts — don't map everything onto the title+bullets slide.
3. **Unpack.**
4. **Structural changes first** (delete / duplicate / reorder — see below).
   Complete ALL structural changes before touching content.
5. **Edit content** in each `slide{N}.xml`. Subagents can edit different slide
   files in parallel — give each the file path, the formatting rules below, and
   the instruction **"use the Edit tool for all changes"**.
6. **Pack + validate.**
7. **Run the QA loop from SKILL.md** — including the leftover-placeholder check:
   ```bash
   python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum|placeholder|this.*(page|slide).*layout"
   ```

---

## Slide Operations

Slide order lives in `ppt/presentation.xml` → `<p:sldIdLst>`. Each entry:

```xml
<p:sldId id="257" r:id="rId3"/>
```

`r:id` maps to a slide file via `ppt/_rels/presentation.xml.rels`.

**Reorder**: rearrange the `<p:sldId>` elements.

**Delete**: remove the `<p:sldId>` entry AND its `<Relationship>` in
`presentation.xml.rels`, then delete `ppt/slides/slideN.xml`, its
`ppt/slides/_rels/slideN.xml.rels`, and its `<Override>` in
`[Content_Types].xml`. Also delete media/notes referenced only by that slide.

**Duplicate** (to reuse a template slide):
1. Copy `ppt/slides/slideN.xml` → `slide{MAX+1}.xml` and
   `ppt/slides/_rels/slideN.xml.rels` → `slide{MAX+1}.xml.rels`
2. In the copied `.rels`, drop any `notesSlide` relationship (or duplicate the
   notes slide too)
3. Add an `<Override>` for the new slide in `[Content_Types].xml`
4. Add a `<Relationship>` with a fresh unused `rId` in
   `presentation.xml.rels` pointing to the new slide
5. Add `<p:sldId id="{max id + 1}" r:id="{new rId}"/>` to `<p:sldIdLst>` at the
   desired position (ids must be ≥ 256 and unique)

After any structural change, repack and convert to PDF to verify the file still
opens before editing content.

---

## Editing Content

For each slide: read the XML, identify ALL placeholder content (text, images,
charts, captions), replace each with final content.

**Use the Edit tool, not sed or Python scripts** — it forces specificity about
what to replace and where.

### Formatting Rules

- **Bold headers, subheadings, and inline labels**: `b="1"` on `<a:rPr>` —
  slide titles, section headers, lead-in labels ("Status:", "Impact:").
- **Never insert unicode bullets (•)** into text — use the layout's list
  formatting (`<a:buChar>` / `<a:buAutoNum>`), or inherit from the layout.
- **Bullet consistency**: let bullets inherit; only specify `<a:buChar>` or
  `<a:buNone>` when overriding deliberately.
- **Whitespace**: add `xml:space="preserve"` on `<a:t>` with leading/trailing
  spaces.

### Multi-Item Content

Multiple items get separate `<a:p>` elements — **never concatenate into one
string**:

```xml
<!-- ❌ WRONG -->
<a:p><a:r><a:rPr .../><a:t>Step 1: Do X. Step 2: Do Y.</a:t></a:r></a:p>

<!-- ✅ CORRECT: one <a:p> per item, copy <a:pPr> from the original to keep spacing -->
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="1800"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="de-DE" sz="1200" b="1"/><a:t>Step 1</a:t></a:r>
</a:p>
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="1800"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="de-DE" sz="1200"/><a:t>Do X.</a:t></a:r>
</a:p>
```

### Smart Quotes

The Edit tool converts smart quotes to ASCII. When adding text with quotes, use
XML entities:

| Character | Name | XML Entity |
|-----------|------|------------|
| “ | Left double quote | `&#x201C;` |
| ” | Right double quote | `&#x201D;` |
| ‘ | Left single quote | `&#x2018;` |
| ’ | Right single quote | `&#x2019;` |

```xml
<a:t>the &#x201C;Agreement&#x201D;</a:t>
```

---

## Template Adaptation Pitfalls

**Template slots ≠ source items.** If the template has 4 team members but you
have 3, delete the 4th member's **entire group** (image + text boxes), not just
the text. Check for orphaned visuals after clearing text; visual QA catches
mismatched counts.

**Text length changes:**
- Shorter replacements: usually safe
- Longer replacements: may overflow or wrap unexpectedly — verify with visual
  QA; truncate or split rather than letting text spill out of its box
