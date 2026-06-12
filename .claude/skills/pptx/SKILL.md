---
name: pptx
description: "Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, board/management presentations; reading, parsing, or extracting text from any .pptx file; editing, modifying, or updating existing presentations; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions \"deck\", \"slides\", \"presentation\", \"PowerPoint\", \"Folien\", \"Präsentation\", or references a .pptx filename, regardless of what they plan to do with the content afterward."
---

# PPTX Skill — Consulting-Grade Presentations

The bar for every deck produced with this skill: **a slide deck a top-tier strategy
consultancy (McKinsey, BCG, Bain) would put in front of a client.** Nobody looking
at the result should be able to tell it was machine-generated.

That bar is reached through two things, in this order:

1. **Storyline discipline** — every slide title is a finding, the titles alone tell
   the whole story, every claim is backed by a number on the slide.
2. **Design restraint** — white background, one accent color, perfect alignment,
   zero decoration.

It is *never* reached through decoration. If you find yourself adding icons,
gradients, cards, or color "to make it less boring", stop — that is exactly what
makes a deck look AI-generated.

**[design.md](design.md) is mandatory reading before creating any deck. Its rules
override your default presentation instincts.**

---

## Quick Reference

| Task | How |
|------|-----|
| Read/analyze content | `python -m markitdown presentation.pptx` |
| Create from scratch | Read [design.md](design.md) **first**, then [pptxgenjs.md](pptxgenjs.md) |
| Edit an existing file / use a template | Read [editing.md](editing.md) (+ design.md for any new content) |

---

## Workflow: Creating a Deck

### 1. Storyline before slides

Do not open an editor until the storyline stands. Write a plain-text outline where
each line is the **action title** of one slide (a full sentence stating a finding,
not a topic — see design.md → Action Titles). Read the outline top to bottom:
if the titles alone don't form a complete, logical argument, fix the outline,
not the slides.

Standard arc: Title → Executive summary → (section divider → evidence slides)
× N → Recommendation / next steps → Appendix/backup.

### 2. Read design.md

All layout, color, typography, chart, and table decisions come from there.

### 3. Build

One Node script using PptxGenJS ([pptxgenjs.md](pptxgenjs.md)). Start from the
scaffold in design.md → Starter Scaffold: shared constants and `slideHeader` /
`slideFooter` helpers guarantee that every slide has identical margins, title
position, hairline, source line, and page number — consistency is what makes a
deck look professionally produced.

### 4. QA loop (required)

See below. At least one full fix-and-verify cycle before declaring success.

---

## QA (Required)

**Assume there are problems. Your job is to find them.** Your first render is
almost never correct. If you found zero issues on first inspection, you weren't
looking hard enough.

### Content QA

```bash
python -m markitdown output.pptx
```

Check: missing content, typos, wrong slide order, leftover placeholder text.
Then read every title in sequence — do they still tell the story on their own?

### Visual QA

Render to images:

```bash
soffice --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
```

**Use subagents for inspection** — even for 2–3 slides. You've been staring at
the code and will see what you expect, not what's there. Prompt template:

```
Visually inspect these slides from a management presentation. Assume there are
issues — find them.

Mechanical issues:
- Overlapping elements, text running through shapes or over other text
- Text overflow / cut off at box or slide edges; titles wrapping to a 3rd line
- Misaligned columns, boxes, or chart edges (off by visible amounts)
- Uneven gaps between parallel elements; elements closer than ~0.25" together
- Footer/source line colliding with content
- Low-contrast text (gray on gray, small light text)

"AI slop" tells (report ANY occurrence):
- Icons in colored circles; decorative icons of any kind; emoji
- Rounded cards with drop shadows; gradients; more than one accent color
- Short colored accent bars under titles
- Giant colored stat numbers; dark "premium" background slides
- Vague topic titles ("Overview", "Key Benefits") instead of full-sentence findings
- Three identical boxes with icon + few words, or the same layout on every slide
- Centered body text; bullet-only slides repeated throughout

For each slide, list issues or areas of concern, even minor ones.

Read and analyze these images:
1. /path/to/slide-01.jpg (Expected: [brief description])
2. /path/to/slide-02.jpg (Expected: [brief description])
```

### Verification loop

1. Generate → render → inspect
2. List issues (if none found, look again more critically)
3. Fix
4. Re-render and re-inspect **affected slides** — one fix often creates another problem
5. Repeat until a full pass reveals no new issues

---

## Dependencies

- `npm install pptxgenjs` (creating from scratch; plus `react react-dom react-icons sharp` only if icons are truly needed)
- `pip install "markitdown[pptx]"` — text extraction
- LibreOffice (`soffice`) — PDF conversion for QA
- Poppler (`pdftoppm`) — PDF → images
