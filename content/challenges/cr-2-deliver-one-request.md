---
slug: cr-2-deliver-one-request
title: Deliver one request
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 70
waiting_minutes: 35
status: draft
submission:
  screenshots:
    min: 3
    max: 5
    label: "plan.md with the four mistakes, the Mode examples frame, and the report with Result: DELIVERED"
  reflection:
    required: true
    min_words: 30
    prompt: For the colour and the padding, which option did you pick (use the nearest, keep the raw value, or ask for a new token) and why? Did Claude get anything wrong in the plan or the build, and what did you change?
rubric:
  - id: plan
    criterion: "plan.md lists the four planted mistakes"
    points: 3
    levels:
      full: "The off-system colour, the off-scale padding, the duplicate layer names and the \"AI tip\" layer all appear"
      partial: "Two or three of the four appear"
      none: "One or none, or no plan"
  - id: modes
    criterion: "A Mode examples frame showing every theme and platform"
    points: 2
    levels:
      full: "Labelled instances; Light and Dark, Desktop and Mobile each appear at least once"
      partial: "The frame is cut off, or some modes are missing"
      none: "No Mode examples frame"
  - id: delivered
    criterion: "The report says \"Result: DELIVERED\""
    points: 3
    levels:
      full: "The report from Copy report, with Result: DELIVERED and their own request on the Request line"
      partial: "Only the preview (Result: PREVIEW), a BLOCKED result, or the report is cut off"
      none: "No report"
  - id: reflection
    criterion: "Explains the two decisions and checks Claude's work"
    points: 2
    levels:
      full: "Names the option picked for the colour and the padding with a reason, and says what was wrong or that nothing was"
      partial: "Only one decision, or no reasons"
      none: "No reflection, or unrelated"
grader_notes: |
  Milestone 2 of 2 in "Deliver a component request". The training client is already set up: a shared workspace
  folder, a training build file with the mirrored tokens (the UXDA Design System Template: Light/Dark,
  Desktop/Mobile) and a "Starter draft" section with a plain card that has four planted mistakes. The learner
  duplicates that section, names it "Request · <Name> Card", and runs /cr-request, /cr-deliver, Token Deliver and
  /cr-next on it. Their playground is a blank file in their own Sandbox folder.
  Screenshot 1: plan.md. Layer cleanup lists the duplicate names (a unique name each) and "AI tip" (a forbidden
  term, with a rename); the flags list the off-system colour (nearest colour and ΔE) and the off-scale padding (the
  steps below and above). Screenshot 2: the Mode examples frame with labelled instances, e.g. Light · Desktop and
  Dark · Mobile; Dark instances should look dark. Screenshot 3: the plugin's report with "Result: DELIVERED".
  A strong reflection: a reason per choice, e.g. "nearest spacing token, 13px was a typo" or "kept the orange raw on
  purpose, recorded", plus one concrete thing they checked in the plan or the build.
  Common mistakes: working in the Starter draft itself instead of a copy; a component name without their own name
  (its tokens then clash with another learner's); the report's "Request:" line naming someone else's request (the
  shared plugin held another delivery: run /cr-deliver again and deliver straight away); Result: BLOCKED because the
  add-variables prompt was accepted (undo the paste, paste again, decline) or a font isn't installed; Result: PREVIEW
  because Deliver wasn't clicked; the plugin run in the browser (no Development menu).
---
Take one ready-made draft through the whole flow: plan, build, check, deliver and close. The client, its tokens and the draft are already set up for you.

**Name** always means your own name, for example **Alvis Card**.

### Before you start (once)
1. Install the **Figma desktop app**, if you don't have it. Development plugins don't run in the browser.
2. In Claude Code, type **/cr-**: the five commands should appear. Run **/mcp** and sign in to Figma, if you haven't yet.
3. Get the training client's workspace folder onto your Mac: **TODO_WORKSPACE_FOLDER**. If it's in a synced folder, set it to **available offline**.
4. In the Figma desktop app, open any file, then **Plugins → Development → Import plugin from manifest…** and choose **token-deliver/manifest.json** in that folder. Don't move or rename the folder afterwards.
5. In your own folder in the **UXDA Sandbox** team, create a blank design file named **Name-CR-playground**. It plays the client's file: Claude never opens it.

### What to do
1. Open the [training build file](TODO_BUILD_FILE_URL) and go to the **Component requests** page.
2. Duplicate the **Starter draft** section (select it, **⌘D**). Rename your copy **Request · Name Card** and the card inside it **Name Card**. Work only in your own section.
3. The draft has four mistakes planted in it: a colour that isn't in the client's system, a padding that's off the spacing scale, two layers with the same name, and a layer named "AI tip". Leave them in.
4. Copy your section's link: select the section and press **⌘L**.
5. Start a new Claude Code chat in the workspace folder and run **/cr-request \<section link\>**. If it asks, the component is **Name Card**.
6. It writes **plan.md** and stops. Find the four mistakes in it. For the colour and the padding, choose: **use the nearest**, **keep the raw value** (on purpose, recorded), or **ask for a new token**. Take a screenshot, then approve the plan.
7. It builds the component and adds a **Mode examples** frame. In the build file, check each instance against the modes named on it. Take a screenshot, then reply **checked**, or say what looks wrong and let it fix it.
8. Run **/cr-deliver**. When it asks which file you'll deliver into, paste the link to your **Name-CR-playground**. If it says another delivery is waiting, someone else is mid-delivery: wait a few minutes and run it again.
9. Straight away, in the **Figma desktop app**: in the build file, select your component and the **Mode examples** frame, **not the section itself**, and press **⌘C**. Open **Name-CR-playground** and press **⌘V**. When Figma asks whether to add variables or styles, **choose not to**.
10. Keep the pasted layers selected and run **Plugins → Development → Token Deliver – …** (it's named after the training client). Read the preview, then click **Deliver**. If it says **BLOCKED**, do what it says and run it again.
11. Click **Copy report** and take a screenshot of the report. In Claude Code, run **/cr-next** and paste the report after it. With nothing left open, it closes the request.

### What to send
- A screenshot of **plan.md** showing the four mistakes (two screenshots if it's long).
- A screenshot of the **Mode examples** frame, with every instance visible.
- A screenshot of the report with **Result: DELIVERED**.
- Which option you picked for the colour and the padding and why, and anything Claude got wrong.
