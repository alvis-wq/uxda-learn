---
slug: bfl-2-name-and-lint
title: Name it right and lint it clean
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 30
waiting_minutes: 10
status: draft
submission:
  screenshots:
    min: 2
    max: 4
    label: The final /ds-lint result, and the layers panel of one screen expanded
  reflection:
    required: true
    min_words: 10
    prompt: Which findings did you fix, which did you leave, and why?
rubric:
  - id: names
    criterion: "Layers follow the naming convention"
    points: 4
    levels:
      full: "Lowercase role names (header, content, actions, title, amount…); no Frame 12, Group 3, copy or 2"
      partial: "Mostly named, but some auto-generated names or leftovers like \"copy\" remain"
      none: "Mostly Frame N / Group N names"
  - id: lint
    criterion: "/ds-lint comes back clean, or every finding left is explained"
    points: 4
    levels:
      full: "The final lint run is clean, or each remaining finding has a reason"
      partial: "Some findings fixed, others left without a reason"
      none: "No lint result, or the first run with nothing fixed"
  - id: reflection
    criterion: "Explains what they fixed and what they left"
    points: 2
    levels:
      full: "Names concrete findings and the decision on each"
      partial: "Vague"
      none: "No reflection"
grader_notes: |
  Milestone 2 of 6 in "Bring your flow to life". Two screenshots: the last /ds-lint report on their flow, and the
  layers panel of one screen expanded. Names should follow the house convention: lowercase role names for frames
  (container, header, content, body, footer, actions, media) and content (title, subtitle, label, value, amount,
  caption, helper, error); no auto-generated names (Frame N, Group N, Rectangle N), no " copy", " 2", "final".
  Vectors inside icons may keep generated names. Why it matters: smart animate in milestones 4–5 matches layers by
  name, so a renamed layer fades instead of moving.
  Common mistakes: renaming only the top level, screenshots of the first lint run instead of the last, renaming
  layers inside library instances (those come from the component).
---
Clean names aren't cosmetic any more: Claude reads your layer names, and Figma's **smart animate** matches layers by name. A layer called **Frame 12** in one screen and **header** in the next fades instead of moving.

### The naming rules
- **Frames get role names:** `container`, `header`, `content`, `body`, `footer`, `actions`, `media`.
- **Content layers get content names:** `title`, `subtitle`, `label`, `value`, `amount`, `caption`, `helper`, `error`.
- **Lowercase**, no leftovers like ` copy`, ` 2`, ` final`, and no `Frame 12` or `Group 3`.
- Vectors inside icons can keep their names.

### What to do
1. Run **/ds-naming-pass** on your flow. Approve the renames you agree with; name the rest yourself.
2. Run **/ds-lint** on each screen.
3. Fix what it finds (it names the fix for each finding), then run **/ds-lint** again until it's clean.
4. If you leave a finding on purpose, write down why.

**Tip:**

> /ds-naming-pass on the flow in my Name-Screen file (link). Use the UXDA house convention.

> /ds-lint this frame (link)

### What to send
- A screenshot of your last **/ds-lint** result.
- A screenshot of one screen's layers panel, fully expanded.
- Which findings you fixed, which you left, and why.
