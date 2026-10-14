---
slug: cds-2-connect-and-harvest
title: Connect and harvest
category: design-systems
audiences: [designer]
path: connect-design-systems
type: screenshot
difficulty: 1
points: 10
status: draft
submission:
  screenshots:
    min: 3
    max: 6
    label: The harvest result for each design system (one screenshot each)
rubric:
  - id: all-three
    criterion: "A harvest result for each of DIB, Arcnine and Template"
    points: 5
    levels:
      full: "Three screenshots, one per design system"
      partial: "Only one or two of them"
      none: "No harvest results"
  - id: worked
    criterion: "Each harvest worked"
    points: 5
    levels:
      full: "Each result shows the harvest finished, with ds-health.json written"
      partial: "One shows an error, or is cut off before the end"
      none: "Errors, or not a harvest result"
grader_notes: |
  Milestone 2 of 3 in "Connect our design systems". Each screenshot should be the end of a /harvest run in Claude
  Code, one per design system (DIB, Arcnine, Template), ideally showing ds-health.json being written.
  Common mistakes: running /harvest without /dsx-connect first (it stops and asks to connect), all three screenshots
  from the same folder, cut-off results.
---
In each design system's chat in Claude Code, run **/dsx-connect** with its Figma link, then run **/harvest**. It worked when the folder has a **ds-health.json** file.

### What to do
For each design system — DIB, Arcnine and Template:
1. Go to its chat in Claude Code (its own section in the sidebar).
2. Run **/dsx-connect** and paste the link to its Figma file.
3. Run **/harvest**.
4. Check that its folder now has a **ds-health.json** file.

### Our three design systems
- **DIB** — find the file in our Figma.
- **Arcnine** — find the file in our Figma.
- **UXDA Design System Template** — [open it in Figma](https://www.figma.com/design/374PbreBmX1o0RkhwnJi1r/UXDA-Design-System-Template-V1?node-id=2368-82)

### What to send
A screenshot of the harvest result for each of the three.
