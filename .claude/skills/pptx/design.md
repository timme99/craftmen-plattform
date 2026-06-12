# Consulting Design System

This document defines how every deck must look and argue. It deliberately replaces
generic "make slides pretty" advice. The target aesthetic is a McKinsey/BCG client
deck: white, dense, rigorously aligned, one accent color, every slide built around
a quantified finding.

**Core principle: a consulting deck persuades through structure and evidence, not
decoration. Restraint reads as confidence; decoration reads as AI.**

---

## 1. The Anti-Slop Blacklist

These are the visual and verbal tells of AI-generated decks. **Never** use any of
them, on any slide, for any reason:

1. **Topic titles** — "Overview", "Our Approach", "Key Benefits", "Marktanalyse".
   Every title must be a full-sentence finding (Section 2).
2. **Icons in colored circles**, icon grids, decorative icons next to headers.
3. **Rounded cards with drop shadows** as content containers.
4. **Gradients** — backgrounds, fills, anywhere.
5. **More than one accent color.** One accent + grayscale. Period.
6. **Emoji.** Anywhere, including speaker notes.
7. **Giant colored stat numbers** (60–72pt callouts with tiny labels).
8. **Short colored accent bars under titles.**
9. **Dark "premium" background slides** or dark/light "sandwich" structures.
   Every slide is white.
10. **Centered body text.** Left-align everything except numbers in tables
    (right-aligned) and labels inside shapes.
11. **Decorative stock photos**, half-bleed hero images, abstract illustrations.
    Images only when they ARE evidence (product photo, screenshot, map).
12. **Three identical boxes with icon + 8 words each** — the signature AI layout.
13. **Filler language** — "leveraging synergies", "unlocking potential",
    "ganzheitlicher Ansatz". Every claim carries a number, a name, or a date.
14. **The same layout repeated on every slide** — vary via the layout vocabulary
    in Section 6, driven by what the content needs.

If a slide feels "boring", the fix is a sharper title and better evidence — never
decoration.

---

## 2. Storyline & Action Titles

### Horizontal logic

Read only the titles, top to bottom: they must form a complete, persuasive
argument (situation → complication → resolution, or finding → finding → implication
→ recommendation). If a slide's title doesn't advance the argument, the slide gets
cut or merged.

### Action titles

Every content slide title is a **full sentence with a verb and a so-what**,
max 2 lines (~8–16 words):

| ❌ Topic title | ✅ Action title |
|---------------|----------------|
| Maintenance costs | Maintenance costs rose 23% since 2023, driven by the aging vehicle fleet |
| Market overview | The German market grows 4% p.a., but 80% of growth is concentrated in two segments |
| Next steps | Three measures can recover EUR 1.2m run-rate savings within 12 months |

### Vertical logic

The body of the slide exists to **prove its title** — nothing else. One message
per slide. Evidence that doesn't support the title moves to another slide or the
appendix.

### Executive summary

Slide 2 of every deck ≥ 8 slides: 3–5 numbered statements (the chapter takeaways),
each with a **bold lead-in** phrase followed by a normal-weight elaboration with
numbers. This slide is text-only and that is correct — do not decorate it.

---

## 3. Page Architecture

Use `LAYOUT_WIDE` (13.33" × 7.5"). Identical on every content slide:

| Zone | Position | Content |
|------|----------|---------|
| Title | y 0.32–1.15", full width minus margins | Action title, 20pt bold black, left, top-anchored |
| Header rule | y ≈ 1.28" | **Full-width** 0.75pt hairline `BFBFBF` (full-width structural rule — allowed; short accent bars — banned) |
| Body | y 1.5–6.9" | Content on the grid |
| Footer | y ≈ 7.1" | Source line left (8pt gray), page number right (9pt gray) |

- **Margins:** 0.55" left/right. Nothing crosses them.
- **Grid:** divide the body zone into halves, thirds, or quarters with fixed
  gutters (0.25–0.35"). Compute all x/w values from constants — never eyeball.
  Parallel elements get *identical* heights and y positions.
- **Density:** consulting slides are denser than typical slideware — body text
  down to 10–11pt is fine. What must be perfect is alignment, not emptiness.

**Title slide:** white. Deck title 30pt bold left-aligned at ~40% height, thin
hairline above or below the title block, subtitle/date/client 13pt gray below.
No image, no dark background.

**Section dividers:** white, section number ("03") in 80–100pt very light gray
(`E8E8E8`) as background element, section title 24pt bold black, one-line preview
of the section's takeaway in gray.

---

## 4. Color

```
ink     000000   titles, key figures, table headers
body    404040   body text
muted   7F7F7F   sources, footnotes, page numbers, axis labels
line    BFBFBF   hairlines, table rules, chart gridlines
ghost   E8E8E8   background numerals, de-emphasized fills
accent  1F4E79   THE one accent — pick per deck (see below)
accentLight D6E4F0   tint of accent for highlight fills / table header rows
```

- **Pick the accent from the client's brand or the topic** (deep blue `1F4E79`,
  bottle green `1E5631`, oxblood `7B1E26`, slate `36454F`) — then never deviate.
- **Color = meaning, never decoration.** The accent marks exactly the element
  that proves the title: the one bar that matters, the recommended option's
  column, the highlighted row. Everything that is context stays gray.
- A slide where everything is colored highlights nothing. Most slides should be
  >90% black/gray/white.

---

## 5. Typography

- **One font family for the whole deck.** Default: Arial. (Georgia for titles +
  Arial for body is the only permitted pairing, for "house style" decks.)
- Title 20pt bold · column/box headers 12–13pt bold · body 10.5–12pt ·
  chart labels 9–10pt · sources/footnotes 8pt gray.
- Bold is the only emphasis: bold lead-ins, bold key figures inside sentences.
  No italics for emphasis, no underlines, no colored words mid-sentence (except
  accent on THE key figure, sparingly).
- Line spacing tight: `lineSpacing` ≈ 1.15× font size for body blocks.

---

## 6. Layout Vocabulary

Choose per slide based on what proves the title. Vary across the deck.

**Executive summary / text slide** — numbered statements, bold lead-ins, generous
left indent for the numbers. No visuals.

**Column comparison (2–4 columns)** — each column: header bar (rectangle filled
accent — or gray for non-recommended options — with white 11–12pt bold label,
0.35" tall) + white body below with a thin outline `line` or just aligned text.
Identical widths and heights. The recommended option gets the accent header
and/or an `accentLight` body fill; the others stay gray.

**Quant slide (chart + takeaways)** — chart on the left ~60%, right ~40% a
"So what" column: 2–4 short statements with bold lead-ins, each aligned to the
chart region it interprets. This is the workhorse layout for evidence slides.

**Process / phases** — horizontal `CHEVRON` shapes (pptxgen `pres.shapes.CHEVRON`),
gray fills with the current/critical phase in accent, white bold labels inside,
detail bullets in aligned columns beneath each chevron.

**2×2 matrix** — two hairline axes with small arrowheads, 9pt gray axis labels,
items as small accent-outlined circles or 10pt labels positioned by value;
the winning quadrant may carry an `accentLight` fill.

**Framework / structure slide** — rectangles with 0.75pt gray outlines, no fill,
no shadows, no rounded corners; hierarchy shown by position and size, connected
by thin straight lines (`pres.shapes.LINE`), not arrows in five colors.

**Table slide** — see Section 8.

---

## 7. Charts

Charts carry the argument; they must look like analyst output, not dashboard art.

- **Gray by default, accent for the message.** All bars/lines `A6A6A6`; only the
  element the title talks about gets `accent`. With `chartColors`, list colors
  per data point: `chartColors: ["A6A6A6","A6A6A6","1F4E79","A6A6A6"]`.
- **Direct labels, no legend** for ≤2 series: `showValue: true`,
  `dataLabelColor: "404040"`, `dataLabelFontSize: 9`, `showLegend: false`.
- **Strip the frame:** no chart border, `catGridLine: { style: "none" }`,
  `valGridLine: { style: "none" }` (or `E8E8E8` 0.5pt if values aren't labeled),
  axis labels 9pt `7F7F7F`. When every bar is labeled, hide the value axis
  entirely (`valAxisHidden: true`).
- **Units once**, as a small 9pt gray label above the chart ("EUR m", "FTE",
  "% of revenue") — not repeated in every label, never in the title.
- **Growth callouts** (CAGR brackets, delta arrows) drawn as thin gray lines +
  9pt annotation, only when growth IS the message.
- **Source line required** under every chart slide (footer).
- Pie charts: avoid; use a bar. If unavoidable, max 4 segments, accent on one.

---

## 8. Tables

- White background. **Horizontal hairlines only** (0.5–0.75pt `BFBFBF`), no
  vertical lines, no alternating row colors.
- Header row: bold, `accentLight` fill (or just bold with a heavier bottom
  border), 10–11pt.
- Numbers right-aligned with consistent decimals and thousands separators;
  text left-aligned.
- Highlight ONE row or column (the recommendation, the total) with `accentLight`
  fill or bold — not both, not several.

---

## 9. Starter Scaffold

Start every from-scratch build from this skeleton. The helpers guarantee identical
geometry on every slide.

```javascript
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

const C = {
  ink: "000000", body: "404040", muted: "7F7F7F",
  line: "BFBFBF", ghost: "E8E8E8",
  accent: "1F4E79", accentLight: "D6E4F0",
};
const FONT = "Arial";
const PW = 13.33, PH = 7.5, M = 0.55;       // page + margin
const CW = PW - 2 * M;                       // content width
const BODY_Y = 1.5, BODY_H = 5.4;            // body zone

// Grid helper: x/width of column i of n (gutter g)
function col(i, n, g = 0.3) {
  const w = (CW - (n - 1) * g) / n;
  return { x: M + i * (w + g), w };
}

function slideHeader(slide, title, kicker) {
  slide.addText(title, {
    x: M, y: 0.32, w: CW, h: 0.85, margin: 0,
    fontFace: FONT, fontSize: 20, bold: true, color: C.ink,
    align: "left", valign: "top", lineSpacing: 24,
  });
  if (kicker) slide.addText(kicker, {
    x: M, y: 1.02, w: CW, h: 0.25, margin: 0,
    fontFace: FONT, fontSize: 11, color: C.muted, align: "left",
  });
  slide.addShape(pres.shapes.LINE, {
    x: M, y: 1.28, w: CW, h: 0, line: { color: C.line, width: 0.75 },
  });
}

function slideFooter(slide, pageNum, source) {
  if (source) slide.addText(`Source: ${source}`, {
    x: M, y: PH - 0.42, w: CW - 1, h: 0.3, margin: 0,
    fontFace: FONT, fontSize: 8, color: C.muted, align: "left",
  });
  slide.addText(String(pageNum), {
    x: PW - M - 0.6, y: PH - 0.42, w: 0.6, h: 0.3, margin: 0,
    fontFace: FONT, fontSize: 9, color: C.muted, align: "right",
  });
}

// Per content slide:
// const s = pres.addSlide();
// slideHeader(s, "Action title stating the finding with a number", "EUR m, 2023–2026");
// ...body on the grid via col()...
// slideFooter(s, 3, "Company financials; team analysis");

pres.writeFile({ fileName: "deck.pptx" });
```

---

## 10. Self-Check Before QA

Before rendering, verify against this list:

- [ ] Titles alone tell the complete story (read them in sequence)
- [ ] Every title is a full sentence with a so-what; none is a topic label
- [ ] Every quantitative claim has its number on the slide; every data slide has a source
- [ ] Exactly one accent color; >90% of each slide is black/gray/white
- [ ] Zero items from the blacklist (Section 1) anywhere
- [ ] All parallel elements share identical dimensions and alignment (computed, not eyeballed)
- [ ] Header, hairline, footer identical on every content slide
