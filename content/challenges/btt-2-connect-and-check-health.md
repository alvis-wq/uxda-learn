---
slug: btt-2-connect-and-check-health
title: Connect and check health
category: design-systems
audiences: [designer]
path: brand-the-template
type: screenshot
difficulty: 1
points: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 3
    label: A screenshot of the health status
rubric:
  - id: health
    criterion: "The Health tab shows a health status"
    points: 6
    levels:
      full: "The plugin's Health tab with a health status loaded"
      partial: "The plugin is open, but no status is loaded"
      none: "No Health tab"
  - id: own-copy
    criterion: "It's their own copy, not the original template"
    points: 4
    levels:
      full: "Their Name-DS-test-template file or folder is visible"
      partial: "Can't tell which file it is"
      none: "The original template or another design system"
grader_notes: |
  Milestone 2 of 4 in "Bring a brand into the template". The screenshot: UXDA Design System Cheatsheet plugin, Health
  tab, status loaded for their Name-DS-test-template copy (file or folder name visible).
  Common mistakes: connecting the original template's link instead of their copy, choosing another folder.
---
Connect your copy in Claude Code, then check its health in Figma.

**Name** always means your own name, for example **Alvis-DS-test-template**.

### What to do
1. Start a new chat in Claude Code and open your **Name-DS-test-template** folder.
2. Run **/dsx-connect** with the link to your copy.
3. Run **/harvest**.
4. Open your copy in Figma, run the **UXDA Design System Cheatsheet** plugin and open the **Health** tab.

### What to send
A screenshot of the health status.
