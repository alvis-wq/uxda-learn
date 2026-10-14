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
    min: 5
    max: 10
    label: The harvest result for each Figma file (one screenshot each, 5 in all)
rubric:
  - id: all-five
    criterion: "A harvest result for each of Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template"
    points: 5
    levels:
      full: "Five screenshots, one per Figma file"
      partial: "Some of them are missing"
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
  Code, one per Figma file (Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template), ideally showing ds-health.json being written.
  Common mistakes: running /harvest without /dsx-connect first (it stops and asks to connect), several screenshots
  from the same folder, cut-off results.
---
In each folder's chat in Claude Code, run **/dsx-connect** with its Figma link, then run **/harvest**. It worked when the folder has a **ds-health.json** file.

### What to do
For each Figma file — Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template:
1. Go to its chat in Claude Code (its own section in the sidebar).
2. Run **/dsx-connect** and paste the link to its Figma file.
3. Run **/harvest**.
4. Check that its folder now has a **ds-health.json** file.

### Our five design system files
- **Arcnine Desktop** — find the file in our Figma.
- **Arcnine Mobile** — find the file in our Figma.
- **DIB Components** — find the file in our Figma.
- **DIB Tokens** — find the file in our Figma.
- **Template** — the UXDA Design System Template: [open it in Figma](https://www.figma.com/design/374PbreBmX1o0RkhwnJi1r/UXDA-Design-System-Template-V1?node-id=2368-82)

### What to send
A screenshot of the harvest result for each of the five.
