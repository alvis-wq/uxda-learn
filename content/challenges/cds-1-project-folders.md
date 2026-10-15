---
slug: cds-1-project-folders
title: Set up the project folders
category: design-systems
audiences: [designer]
path: connect-design-systems
type: screenshot
difficulty: 1
points: 10
estimated_minutes: 20
waiting_minutes: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 3
    label: A screenshot of your Claude Code sidebar
rubric:
  - id: folders
    criterion: "Five folders named Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template"
    points: 5
    levels:
      full: "All five folders are there, named Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template"
      partial: "Some are missing, or named differently"
      none: "No folders visible"
  - id: sidebar
    criterion: "Five sections in the Claude Code sidebar, each with a chat where /dsx-connect was run"
    points: 5
    levels:
      full: "The sidebar shows five separate sections, one per folder, each with a /dsx-connect chat"
      partial: "Fewer than five sections, one parent folder opened once, or some sections have no /dsx-connect chat"
      none: "The screenshot isn't the Claude Code sidebar"
grader_notes: |
  Milestone 1 of 3 in "Connect our design systems". Look at the Claude Code sidebar in the screenshot.
  A strong answer: five separate sections named Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template, one per Figma file,
  each with a chat where /dsx-connect was run (usually titled like "DSX Connect design system"; like the example image in the brief;
  the path Documents/UXDA-DS/ may show).
  Common mistakes: opening the UXDA-DS folder once (one section, with subfolders), one folder for DIB or Arcnine
  instead of one per file, different folder names, sections with no /dsx-connect chat.
---
In **Documents/UXDA-DS/**, create one folder per Figma file: **Arcnine Desktop**, **Arcnine Mobile**, **DIB Components**, **DIB Tokens** and **Template**. Open each folder in Claude Code and connect it to its Figma file with **/dsx-connect**.

### What to do
1. Create the folder **Documents/UXDA-DS/** if you don't have it yet.
2. Inside it, create five folders: **Arcnine Desktop**, **Arcnine Mobile**, **DIB Components**, **DIB Tokens** and **Template**.
3. Open each of the five folders in Claude Code (see below).
4. In each folder's chat, run **/dsx-connect [Figma link]** with the link to that folder's design system file. This also makes each folder show up as its own section, with a chat, in the sidebar.

### How to open a new folder in Claude Code
1. In the Claude Code sidebar, click **New**.

   ![Step 1: the Claude Code sidebar with New at the top](/challenges/claude-code-open-folder-1.png)

2. Under the chat box, click **Choose…** and pick the folder.

   ![Step 2: the new chat box, with the Choose… folder button circled below it](/challenges/claude-code-open-folder-2.png)

### Our five design system files
- **Arcnine Desktop** — find the file in our Figma.
- **Arcnine Mobile** — find the file in our Figma.
- **DIB Components** — find the file in our Figma.
- **DIB Tokens** — find the file in our Figma.
- **Template** — the UXDA Design System Template: [open it in Figma](https://www.figma.com/design/374PbreBmX1o0RkhwnJi1r/UXDA-Design-System-Template-V1?node-id=2368-82)

### What to send
A screenshot of your Claude Code sidebar. Your sidebar should look like this:

![Example Claude Code sidebar with a separate section for each folder: Arcnine Desktop, Arcnine Mobile, DIB Components, DIB Tokens and Template, each with a "DSX Connect design system" chat](/challenges/claude-code-sidebar.png "side")
