---
slug: cds-3-health-in-figma
title: Check the health in Figma
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
    label: The health status for each Figma file (one screenshot each, 5 in all)
rubric:
  - id: all-five
    criterion: "A health status for each of Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template"
    points: 5
    levels:
      full: "Five screenshots of the Health tab, one per Figma file"
      partial: "Some of them are missing"
      none: "No Health tab screenshots"
  - id: matching
    criterion: "Each Health tab shows the right file's folder"
    points: 5
    levels:
      full: "Each screenshot shows the health status loaded from the matching folder (DIB Tokens file with the DIB Tokens folder, and so on)"
      partial: "One doesn't match, or it's unclear which folder was chosen"
      none: "The Health tab is empty or shows no status"
grader_notes: |
  Milestone 3 of 3 in "Connect our design systems". Each screenshot: the UXDA Design System Cheatsheet plugin in
  Figma, Health tab, with a health status loaded for that file's own folder (five in all).
  Common mistakes: the same folder chosen for every file, the Health tab open but no folder chosen (no status).
---
Open each design system file in Figma, run the **UXDA Design System Cheatsheet** plugin, open the **Health** tab and choose that file's folder.

### What to do
For each Figma file — Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template:
1. Open its file in Figma.
2. Run the **UXDA Design System Cheatsheet** plugin.
3. Open the **Health** tab.
4. Choose that file's folder (for example **Documents/UXDA-DS/DIB Tokens** for DIB Tokens).

### Our five design system files
- **Arcnine Desktop** — find the file in our Figma.
- **Arcnine Mobile** — find the file in our Figma.
- **DIB Components** — find the file in our Figma.
- **DIB Tokens** — find the file in our Figma.
- **Template** — the UXDA Design System Template: [open it in Figma](https://www.figma.com/design/374PbreBmX1o0RkhwnJi1r/UXDA-Design-System-Template-V1?node-id=2368-82)

### What to send
A screenshot of each health status. Your Health tab should look like this:

![Example Health tab of the UXDA Design System Cheatsheet plugin for the Template file: a health score of 78 (Governed), with scores for Tokens, Components, Documentation and Accessibility](/challenges/figma-health-plugin.png "side")
