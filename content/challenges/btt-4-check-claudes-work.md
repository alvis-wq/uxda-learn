---
slug: btt-4-check-claudes-work
title: Check Claude's work
category: design-systems
audiences: [designer]
path: brand-the-template
type: mixed
difficulty: 1
points: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 3
    label: A screenshot of the Contrast tab
  reflection:
    required: true
    min_words: 10
    prompt: One thing you checked or fixed, and what you found
rubric:
  - id: contrast
    criterion: "A screenshot of the Contrast tab"
    points: 5
    levels:
      full: "The plugin's Contrast tab for their copy, with results"
      partial: "Another tab, or unclear which file"
      none: "Missing"
  - id: note
    criterion: "The note names something specific"
    points: 5
    levels:
      full: "Names a colour pair, token or ramp, and what they found or changed"
      partial: "General, e.g. \"all fine\""
      none: "Missing"
grader_notes: |
  Milestone 4 of 4 in "Bring a brand into the template". After the second /harvest: a screenshot of the Contrast tab
  for their copy, and a note naming something specific (a colour pair that got worse, a renamed or missing token,
  and what they did about it).
  Common mistakes: a screenshot from before the new harvest, a note that says only "looks good".
---
Check Claude's work: did the new colours break anything?

### What to do
1. In the same Claude Code chat, run **/harvest** again.
2. Open your copy in Figma, run the **UXDA Design System Cheatsheet** plugin and look at the **Health** and **Contrast** tabs.
3. Check: did any colour pairs get worse? Is anything renamed or missing? Fix what you find.

### What to send
- A screenshot of the Contrast tab.
- A short note on one thing you checked or fixed.
