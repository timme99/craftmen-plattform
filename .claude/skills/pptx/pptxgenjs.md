# PptxGenJS Technical Reference

Technical how-to only — all design decisions (colors, layouts, typography) come
from [design.md](design.md).

## Setup & Basic Structure

```javascript
const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';  // 13.33" × 7.5" — default for consulting decks
pres.author = 'Author Name';
pres.title = 'Presentation Title';

let slide = pres.addSlide();
slide.addText("Hello World!", { x: 0.5, y: 0.5, fontSize: 36, color: "363636" });

pres.writeFile({ fileName: "Presentation.pptx" });
```

## Layout Dimensions

Slide dimensions (coordinates in inches):
- `LAYOUT_WIDE`: 13.3" × 7.5" (use this)
- `LAYOUT_16x9`: 10" × 5.625"
- `LAYOUT_16x10`: 10" × 6.25"
- `LAYOUT_4x3`: 10" × 7.5"

---

## Text & Formatting

```javascript
// Basic text
slide.addText("Simple Text", {
  x: 1, y: 1, w: 8, h: 2, fontSize: 24, fontFace: "Arial",
  color: "363636", bold: true, align: "left", valign: "middle"
});

// Character spacing (use charSpacing, not letterSpacing which is silently ignored)
slide.addText("SPACED TEXT", { x: 1, y: 1, w: 8, h: 1, charSpacing: 6 });

// Rich text arrays — bold lead-in pattern (the consulting staple)
slide.addText([
  { text: "Cost base: ", options: { bold: true } },
  { text: "maintenance spend rose 23% to EUR 4.1m since 2023" }
], { x: 1, y: 3, w: 8, h: 0.4 });

// Multi-line text (requires breakLine: true)
slide.addText([
  { text: "Line 1", options: { breakLine: true } },
  { text: "Line 2", options: { breakLine: true } },
  { text: "Line 3" }  // Last item doesn't need breakLine
], { x: 0.5, y: 0.5, w: 8, h: 2 });

// Text box margin (internal padding)
slide.addText("Title", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  margin: 0  // Use 0 when aligning text with other elements like shapes or lines
});
```

**Tip:** Text boxes have internal margin by default. Set `margin: 0` when text
must align precisely with shapes, hairlines, or chart edges at the same
x-position — which in this design system is always.

---

## Lists & Bullets

```javascript
// ✅ CORRECT: Multiple bullets
slide.addText([
  { text: "First item", options: { bullet: true, breakLine: true } },
  { text: "Second item", options: { bullet: true, breakLine: true } },
  { text: "Third item", options: { bullet: true } }
], { x: 0.5, y: 0.5, w: 8, h: 3 });

// ❌ WRONG: Never use unicode bullets
slide.addText("• First item", { ... });  // Creates double bullets

// Sub-items and numbered lists
{ text: "Sub-item", options: { bullet: true, indentLevel: 1 } }
{ text: "First", options: { bullet: { type: "number" }, breakLine: true } }

// Dash bullets (cleaner than dots for consulting style)
{ text: "Item", options: { bullet: { characterCode: "2013" }, breakLine: true } }
```

---

## Shapes

```javascript
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 0.8, w: 1.5, h: 3.0,
  fill: { color: "D6E4F0" }, line: { color: "BFBFBF", width: 0.75 }
});

// Outline-only box (framework slides): fill must be explicitly disabled
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { type: "none" }, line: { color: "BFBFBF", width: 0.75 }
});

slide.addShape(pres.shapes.LINE, {
  x: 1, y: 3, w: 5, h: 0, line: { color: "BFBFBF", width: 0.75 }
});

// Chevron (process flows)
slide.addShape(pres.shapes.CHEVRON, {
  x: 1, y: 2, w: 2.4, h: 0.6, fill: { color: "A6A6A6" }
});

// With transparency
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "1F4E79", transparency: 50 }
});
```

Per design.md: no rounded rectangles, no shadows, no gradients. Plain
`RECTANGLE`, `LINE`, `OVAL`, `CHEVRON` cover the entire layout vocabulary.
(Gradient fills aren't natively supported anyway.)

---

## Images

Use only when the image IS evidence (screenshot, product photo, map) — see
design.md blacklist.

```javascript
// From file path
slide.addImage({ path: "images/screenshot.png", x: 1, y: 1, w: 5, h: 3 });

// From base64 (faster, no file I/O)
slide.addImage({ data: "image/png;base64,iVBORw0KGgo...", x: 1, y: 1, w: 5, h: 3 });

// Options
slide.addImage({
  path: "image.png",
  x: 1, y: 1, w: 5, h: 3,
  altText: "Description",       // Accessibility
  sizing: { type: 'contain', w: 5, h: 3 }  // or 'cover', 'crop'
});
```

### Calculate dimensions (preserve aspect ratio)

```javascript
const origWidth = 1978, origHeight = 923, maxHeight = 3.0;
const calcWidth = maxHeight * (origWidth / origHeight);
```

Supported formats: PNG, JPG, GIF, SVG (modern PowerPoint).

---

## Tables

```javascript
// Consulting-style table: horizontal hairlines only, no vertical borders
const rows = [
  [
    { text: "Option", options: { bold: true, fill: { color: "D6E4F0" } } },
    { text: "Capex (EUR m)", options: { bold: true, align: "right", fill: { color: "D6E4F0" } } },
    { text: "Payback", options: { bold: true, align: "right", fill: { color: "D6E4F0" } } },
  ],
  ["Refurbish fleet", { text: "2.4", options: { align: "right" } }, { text: "3.1 yrs", options: { align: "right" } }],
  ["Replace fleet",   { text: "5.8", options: { align: "right" } }, { text: "4.6 yrs", options: { align: "right" } }],
];
slide.addTable(rows, {
  x: 0.55, y: 1.6, w: 7, colW: [3, 2, 2],
  fontFace: "Arial", fontSize: 10.5, color: "404040",
  border: [
    { pt: 0.5, color: "BFBFBF" },          // top
    { type: "none" },                       // right
    { pt: 0.5, color: "BFBFBF" },          // bottom
    { type: "none" },                       // left
  ],
  margin: 0.06, valign: "middle",
});

// Merged cells
[{ text: "Merged", options: { colspan: 2 } }]
```

The 4-element `border` array is `[top, right, bottom, left]` per cell —
horizontal-only rules come from setting left/right to `{ type: "none" }`.

---

## Charts

```javascript
// Bar chart, consulting style: gray context + one accent bar carrying the message
slide.addChart(pres.charts.BAR, [{
  name: "Maintenance cost", labels: ["2022", "2023", "2024", "2025"],
  values: [3.1, 3.3, 3.7, 4.1]
}], {
  x: 0.55, y: 1.6, w: 7, h: 4.6, barDir: "col",

  chartColors: ["A6A6A6", "A6A6A6", "A6A6A6", "1F4E79"],  // per data point

  // Direct labels instead of axis + legend
  showValue: true,
  dataLabelPosition: "outEnd",
  dataLabelColor: "404040",
  dataLabelFontSize: 9,
  showLegend: false,
  showTitle: false,             // the message lives in the slide title

  // Strip the frame
  valAxisHidden: true,
  valGridLine: { style: "none" },
  catGridLine: { style: "none" },
  catAxisLabelColor: "7F7F7F",
  catAxisLabelFontSize: 9,
  catAxisLineColor: "BFBFBF",
});

// Line chart
slide.addChart(pres.charts.LINE, [{
  name: "Revenue", labels: ["Jan", "Feb", "Mar"], values: [32, 35, 42]
}], { x: 0.5, y: 1.6, w: 6, h: 3, lineSize: 2, showLegend: false });

// Multiple series: one accent, rest gray
chartColors: ["1F4E79", "A6A6A6", "BFBFBF"]
```

**Key styling options:**
- `chartColors: [...]` — hex colors; applies per data point (single series) or per series
- `catGridLine/valGridLine: { color, style, size }` — `style: "none"` to hide
- `valAxisHidden: true` — hide value axis when bars are directly labeled
- `dataLabelPosition` — `"outEnd"`, `"inEnd"`, `"center"`
- `legendPos: "b" | "t" | "l" | "r"` — only for 3+ series; prefer direct labels
- `lineSmooth` — leave `false`; smoothed curves misrepresent data

Available chart types: BAR, LINE, PIE, DOUGHNUT, SCATTER, BUBBLE, RADAR.
Avoid PIE/DOUGHNUT/RADAR (design.md §7).

---

## Icons (rarely needed)

design.md bans decorative icons. The only legitimate uses are functional glyphs
(e.g., check/cross marks in a comparison table — though "✓"-as-text via
`{ text: "✓", options: { color: "1F4E79" } }` is usually sufficient and simpler).

If a rasterized icon is genuinely required:

```javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheck } = require("react-icons/fa");

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

slide.addImage({ data: await iconToBase64Png(FaCheck, "#1F4E79"), x: 1, y: 1, w: 0.22, h: 0.22 });
```

Requires `npm install react react-dom react-icons sharp`. Render at size ≥ 256
for crisp output.

---

## Common Pitfalls

⚠️ These cause file corruption, visual bugs, or broken output.

1. **NEVER use "#" with hex colors** — causes file corruption
   ```javascript
   color: "FF0000"      // ✅ CORRECT
   color: "#FF0000"     // ❌ WRONG
   ```

2. **NEVER encode opacity in hex color strings** — 8-char colors (e.g.
   `"00000020"`) corrupt the file. Use the `transparency`/`opacity` property.

3. **Use `bullet: true`** — NEVER unicode "•" symbols (creates double bullets)

4. **Use `breakLine: true`** between array items, or runs concatenate

5. **Avoid `lineSpacing` with bullets** — causes excessive gaps; use
   `paraSpaceAfter` instead

6. **Each presentation needs a fresh `pptxgen()` instance** — never reuse

7. **NEVER reuse option objects across calls** — PptxGenJS mutates them in-place
   (e.g. converting values to EMU). Use a factory:
   ```javascript
   const lineOpts = () => ({ color: "BFBFBF", width: 0.75 });
   slide.addShape(pres.shapes.LINE, { x: 1, y: 3, w: 5, h: 0, line: lineOpts() });
   slide.addShape(pres.shapes.LINE, { x: 1, y: 4, w: 5, h: 0, line: lineOpts() });
   ```

8. **Shadow `offset` must be non-negative** — negative values corrupt the file.
   (Shadows are banned by design.md anyway.)

9. **Forgetting `margin: 0` on text boxes** that must align with shapes/lines —
   the default internal padding shifts text visibly off the grid.
