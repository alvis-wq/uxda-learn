---
slug: dcr-5-deliver-and-close
title: Deliver and close
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 3
points: 10
estimated_minutes: 30
waiting_minutes: 5
status: draft
submission:
  screenshots:
    min: 3
    max: 5
    label: "The BLOCKED preview, the report with Result: DELIVERED, and Claude saying the request is closed"
rubric:
  - id: blocked
    criterion: "The plugin's BLOCKED preview after accepting Figma's add-variables prompt"
    points: 3
    levels:
      full: "The plugin preview says BLOCKED and explains the accepted prompt"
      partial: "A plugin preview, but not the BLOCKED one"
      none: "No BLOCKED screenshot"
  - id: delivered
    criterion: "The report says \"Result: DELIVERED\""
    points: 4
    levels:
      full: "The report from Copy report, with Result: DELIVERED"
      partial: "Only the preview (Result: PREVIEW), or the report is cut off"
      none: "No report"
  - id: closed
    criterion: "/cr-next closed the request"
    points: 3
    levels:
      full: "Claude's message says the request is closed and logged"
      partial: "The request is delivered but still has open items"
      none: "/cr-next not run"
grader_notes: |
  Milestone 5 of 6 in "Deliver a component request". The order: /cr-deliver (checks everything and loads the plugin
  with this request; it confirms the playground is on the off-limits list); copy the component and Mode examples
  (not the section); paste into Name-CR-playground and accept the add-variables prompt on purpose; run the plugin:
  BLOCKED; ⌘Z, paste again, decline; run the plugin; Deliver; Copy report; /cr-next <report> closes the request
  ("Nothing open" closes it and logs it).
  Common mistakes: selecting the section instead of the component and Mode examples; accepting the add-variables
  prompt on the second paste too (still BLOCKED); running the plugin in the browser (no Development menu); a report
  whose "Request:" line names another request (another copy of the plugin ran: remove it under Manage plugins in
  development and import it again); open items left because the card used instances of other components (they're
  listed to swap by hand; the request then stays "delivered", partial on closed).
---
Deliver the component into the playground, make one mistake on purpose to see the plugin catch it, then close the request.

The playground plays the client's file. Every step here is yours: Claude never opens it.

### What to do
1. In Claude Code, in the client's workspace folder, run **/cr-deliver**. It checks everything (no raw values, no duplicate layer names, nothing mentioning Claude, Anthropic or AI) and loads the plugin with this request.
2. In the **Figma desktop app**, open **Name-CR-build** and the request's section. Select the component and the **Mode examples** frame, **not the section itself**. Press **⌘C**.
3. Open **Name-CR-playground** and press **⌘V**.
4. **On purpose this once:** when Figma asks whether to add variables or styles, **accept**.
5. Keep the pasted layers selected and run **Plugins → Development → Token Deliver – \<your client\>**. The preview says **BLOCKED**. Take a screenshot.
6. Undo the paste (**⌘Z**), press **⌘V** again, and this time **choose not to** add variables or styles (or let the prompt close by itself).
7. Keep the pasted layers selected and run the plugin again (**⌥⌘P** reruns the last plugin).
8. Read the preview: what will be relinked and added, collections to create, conflicts and bindings.
9. Click **Deliver**. A message confirms it, and the report appears.
10. Click **Copy report**, then in Claude Code run **/cr-next** and paste the report after it.
11. With nothing left open, it closes the request and logs it.

### What to send
- A screenshot of the **BLOCKED** preview.
- A screenshot of the report with **Result: DELIVERED**.
- A screenshot of Claude saying the request is closed.
