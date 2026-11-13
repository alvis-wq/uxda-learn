---
slug: dcr-2-set-up-the-client
title: Set up the client
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 60
waiting_minutes: 40
status: draft
submission:
  screenshots:
    min: 2
    max: 4
    label: Claude's message that every mirrored value was checked, and Token Deliver – <your client> under Plugins → Development
rubric:
  - id: mirror-checked
    criterion: "Claude reports that every mirrored value was checked, with the number it checked"
    points: 4
    levels:
      full: "The message shows the value check passed and gives the number of values checked"
      partial: "Only counts or a summary, with no value check shown"
      none: "No mirror message, or the check didn't pass"
  - id: plugin-imported
    criterion: "Token Deliver – <client> is listed under Plugins → Development in the Figma desktop app"
    points: 4
    levels:
      full: "The plugin with their invented client's name shows in the Development menu"
      partial: "The import window is shown, but not the plugin in the menu"
      none: "No plugin shown"
  - id: fictional-client
    criterion: "An invented client name throughout"
    points: 2
    levels:
      full: "A made-up client name, e.g. Acme Bank"
      partial: "No client name visible"
      none: "A real client's name"
grader_notes: |
  Milestone 2 of 6 in "Deliver a component request". /cr-setup asks for: the client name, the off-limits files
  (the playground), the build file, the workspace folder (default ~/Documents/UXDA Component Requests/), then runs
  /cr-tokens (source: the Name-CR-tokens copy; confirm the architecture; confirm the policy; mirror and check), then
  gives the plugin to import. Screenshot 1: Claude's message after the mirror, saying the values were checked and how
  many (the template has about 700 variables plus text and effect styles). Screenshot 2: the Figma desktop app's
  Plugins → Development menu showing "Token Deliver – <client>".
  Common mistakes: giving the build file as an off-limits file (setup stops and asks), the Figma browser app instead
  of desktop (no Development menu), the plugin imported from a workspace folder that was later moved or renamed (it
  stops working; import it again), a real client's name.
---
Set up your invented client in the plugin: its workspace, a mirror of its tokens in your build file, and its own Token Deliver plugin.

### What to do
1. Open Claude Code in **~/Documents/UXDA Component Requests/** (create the folder if it's missing) and run **/cr-setup**.
2. It asks one question at a time:
   1. **The Figma desktop app** and **Figma in Claude Code**: say yes, and sign in with **/mcp** if it asks.
   2. **The client's name**: your invented client, for example **Acme Bank**.
   3. **Files it must never open**: paste the link to **Name-CR-playground**. That's the "client file" here.
   4. **The build file**: paste the link to **Name-CR-build**, and confirm it's in a UXDA folder. Keep the default requests page, "Component requests".
   5. **The workspace folder**: keep the default. It creates the client's folder inside it.
3. It then runs **/cr-tokens** for you:
   1. **Choose a source**: the owned duplicate, **Name-CR-tokens**. It asks which Figma folder it's in: your Sandbox folder.
   2. **Confirm the architecture**: read its plain-words summary of the token system and confirm it.
   3. **Confirm the policy**: how new tokens are made. Confirm it.
   4. **Build the mirror**: it copies the whole system into **Name-CR-build** and checks every value. This is the long wait; do something else meanwhile.
4. At the end, import the plugin in the **Figma desktop app**: open any file, then **Plugins → Development → Import plugin from manifest…** and choose **token-deliver/manifest.json** in the client's workspace folder.

**Don't move or rename the workspace folder after importing.** Figma remembers the path, and a moved folder breaks the plugin. If it was moved, import it again from the new place.

From now on, open Claude Code in the client's workspace folder (for example **UXDA Component Requests/acme-bank**).

### What to send
- A screenshot of Claude's message that every mirrored value was checked (it gives the number).
- A screenshot of **Token Deliver – \<your client\>** under **Plugins → Development**.
