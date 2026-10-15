---
slug: cds-2-connect-and-harvest
title: Harvest each design system
category: design-systems
audiences: [designer]
path: connect-design-systems
type: screenshot
difficulty: 1
points: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 5
    label: A screenshot of your folder structure, with the harvested files in each of the five folders
rubric:
  - id: all-five
    criterion: "All five folders are shown: Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template"
    points: 5
    levels:
      full: "All five folders are open, so their files show"
      partial: "Some folders are missing or closed, so their files don't show"
      none: "No folder structure"
  - id: harvested
    criterion: "Each folder contains a ds-health.json file"
    points: 5
    levels:
      full: "ds-health.json is in all five folders"
      partial: "ds-health.json is missing from one or more folders"
      none: "No ds-health.json files, or not the UXDA-DS folders"
grader_notes: |
  Milestone 2 of 3 in "Connect our design systems". The screenshot(s) should show the UXDA-DS folder (Finder or similar)
  with Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template open, each containing ds-health.json
  (CLAUDE.md and other files may show too; like the example image in the brief). Several screenshots are fine if
  they don't fit in one.
  Common mistakes: folders left closed so the files don't show (the example has DIB Tokens closed — theirs shouldn't),
  ds-health.json missing in one folder (/harvest wasn't run there or stopped early).
---
In each of the five folders' chats in Claude Code, run **/harvest**. It worked when each folder contains a **ds-health.json** file.

### What to do
For each folder — Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template:
1. Go to its chat in Claude Code (its own section in the sidebar).
2. Run **/harvest**.
3. Check that the folder now contains a **ds-health.json** file.

### What to send
One screenshot of your folder structure, with each of the five folders open so the harvested files show.

Yours should look like this:

![Example folder structure in Finder: the UXDA-DS folder with Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template, each folder containing CLAUDE.md and ds-health.json](/challenges/harvest-folder-structure.png)
