---
slug: btt-3-brand-colours
title: Bring in the brand colours
category: design-systems
audiences: [designer]
path: brand-the-template
type: mixed
difficulty: 2
points: 20
estimated_minutes: 30
waiting_minutes: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 3
    label: A screenshot of the brand's colours
  figma_url:
    required: true
    label: Link to your copy in Figma
  reflection:
    required: true
    min_words: 20
    prompt: Paste Claude's report of what it changed
rubric:
  - id: brand
    criterion: "A screenshot of a real brand's colour guide"
    points: 4
    levels:
      full: "The brand's colours are clearly visible"
      partial: "Hard to read, or only a few colours"
      none: "Missing, or not a colour guide"
  - id: replaced
    criterion: "Matching ramps are replaced with real brand colour ramps"
    points: 8
    levels:
      full: "In the copy, the Brand [PLACEHOLDER] ramps that match now hold the brand's colours as full ramps"
      partial: "Some colours changed, but ramps are incomplete or don't match the guide"
      none: "Nothing changed"
  - id: kept
    criterion: "The rest are still placeholders"
    points: 4
    levels:
      full: "Ramps with no brand match are still named Brand [PLACEHOLDER] and unchanged"
      partial: "Some unmatched ramps were changed or removed"
      none: "The placeholders are gone or renamed without a match"
  - id: report
    criterion: "Claude's report says what changed"
    points: 4
    levels:
      full: "The pasted report names each ramp that changed"
      partial: "Vague, or only part of it"
      none: "No report"
grader_notes: |
  Milestone 3 of 4 in "Bring a brand into the template". Compare the brand screenshot with the colour variables in
  their copy: ramps that match the brand should hold the brand's colours (whole ramps, not single swatches); the rest
  should still be "Brand [PLACEHOLDER]" and unchanged. The pasted report should list each changed ramp.
  Common mistakes: every placeholder overwritten (even ones with no brand match), single colours instead of ramps,
  renamed tokens. If the link can't be opened: confidence low, flag figma_inaccessible.
---
Replace the template's placeholder colours with a real brand's colours, with Claude's help.

**Name** always means your own name, for example **Alvis-DS-test-template**.

### What to do
1. Find any brand's colour guide online and take a screenshot of its colours.
2. In the same Claude Code chat as before (your **Name-DS-test-template** folder), give Claude the screenshot.
3. Ask Claude to compare the brand colours with the template's colour tokens. The template uses placeholder ramps named **"Brand [PLACEHOLDER]"**. Replace what matches with real brand colour ramps, and keep the rest as placeholders.
4. Ask Claude to report what it changed.

### Example prompt
> Here's a brand colour guide. Compare it with the Brand [PLACEHOLDER] colour ramps in this design system. Replace the ramps that match with real brand colour ramps, keep the rest as placeholders, and tell me exactly what you changed.

### What to send
- The brand screenshot.
- The link to your copy.
- Claude's report, pasted as text.
