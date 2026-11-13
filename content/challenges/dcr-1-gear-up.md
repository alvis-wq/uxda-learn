---
slug: dcr-1-gear-up
title: Gear up and make the sandbox
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 1
points: 10
estimated_minutes: 20
status: draft
submission:
  screenshots:
    min: 2
    max: 3
    label: Claude Code showing the five /cr- commands, and your Sandbox folder with the three files
rubric:
  - id: commands
    criterion: "Typing /cr- in Claude Code shows the five commands"
    points: 4
    levels:
      full: "/cr-setup, /cr-tokens, /cr-request, /cr-deliver and /cr-next all show"
      partial: "Some commands show, but not all five"
      none: "No commands, or not the uxda-component-requests plugin"
  - id: three-files
    criterion: "Three files in their own Sandbox folder: the template copy, the build file and the playground"
    points: 4
    levels:
      full: "All three files, named like Alvis-CR-tokens, Alvis-CR-build and Alvis-CR-playground"
      partial: "One file missing, or the files are in Drafts or another folder"
      none: "No files shown, or files from the UXDA Clients folder"
  - id: copy
    criterion: "The tokens file is a copy of the design system template"
    points: 2
    levels:
      full: "Thumbnail or name shows a copy of the template, not the original"
      partial: "A copy, but of another file"
      none: "No copy, or the original template"
grader_notes: |
  Milestone 1 of 6 in "Deliver a component request". Screenshot 1: Claude Code with "/cr-" typed and the five
  commands listed (/cr-setup, /cr-tokens, /cr-request, /cr-deliver, /cr-next). Screenshot 2: their own folder in the
  UXDA Sandbox team with three files: Name-CR-tokens (a copy of the UXDA Design System Template, key
  374PbreBmX1o0RkhwnJi1r for the original), Name-CR-build and Name-CR-playground. Other files in the folder are fine.
  Slightly different names are fine if each file's role is clear.
  Common mistakes: the plugin installed but Claude Code not restarted, so the commands don't show yet; files left in
  Drafts; the original template used instead of a copy; any file from the UXDA Clients folder (score 0 on three-files
  and say why).
---
Get the tools ready and make three sandbox files to practise on.

**Name** always means your own name, for example **Alvis-CR-build**.

### What to do
**Tools**
1. Install the **Figma desktop app**, if you don't have it. Development plugins don't run in the browser.
2. In Claude Code, install the plugin:

   ```
   /plugin marketplace add https://github.com/UXDA-org/uxda-claude-skills.git
   /plugin install uxda-component-requests@uxda-plugins
   ```

   Already added the marketplace for another UXDA plugin? Skip the first line. You need version **0.2.1** or later.
3. Restart Claude Code, then type **/cr-**. The five commands should appear.
4. Run **/mcp** and sign in to Figma, if you haven't yet.
5. The plugin runs small Python scripts. If macOS offers to install the Command Line Tools the first time, accept.

**Sandbox files**, all in your own folder in the **UXDA Sandbox** team (the one from "Build a screen with the template"):
1. Open the [design system template](https://www.figma.com/design/374PbreBmX1o0RkhwnJi1r/UXDA-Design-System-Template-V1?node-id=2368-82), duplicate it, move the copy into your folder and name it **Name-CR-tokens**. This is your invented client's design system. It has Light/Dark and Desktop/Mobile modes.
2. Create a blank design file named **Name-CR-build**. Components are built here.
3. Create a blank design file named **Name-CR-playground**. This plays the client's file that you deliver into.

Never use a file from the **UXDA Clients** folder. Make up a client name for the next step, for example **Acme Bank**.

### What to send
- A screenshot of Claude Code with **/cr-** typed and the five commands showing.
- A screenshot of your Sandbox folder with the three files.
