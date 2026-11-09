---
slug: bfl-1-build-the-flow
title: Build the flow
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: mixed
difficulty: 2
points: 10
estimated_minutes: 40
waiting_minutes: 20
status: draft
submission:
  figma_url:
    required: true
    label: Link to the flow in Name-Screen (anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 3
    label: A screenshot of the whole flow, screens side by side
  reflection:
    required: true
    min_words: 10
    prompt: What did Claude get wrong in the screens, and what did you change?
rubric:
  - id: flow
    criterion: "A flow of 3 or 4 mobile screens that follow each other"
    points: 3
    levels:
      full: "3–4 screens of one task, in order, e.g. welcome → log in → home"
      partial: "Only 2 screens, or screens that don't make one task"
      none: "One screen, or no flow"
  - id: components
    criterion: "Built only from their Name-DS-template library"
    points: 3
    levels:
      full: "Every part is an instance from their Name-DS-template library; nothing detached"
      partial: "Mostly, but some parts are detached, drawn by hand or from another library"
      none: "Drawn by hand, or from another library"
  - id: content
    criterion: "Real content, not placeholders"
    points: 2
    levels:
      full: "Real labels and copy on every screen"
      partial: "Some Lorem ipsum, \"Label\" or \"Button\" left"
      none: "Placeholder text throughout"
  - id: reflection
    criterion: "Says what Claude got wrong and what they changed"
    points: 2
    levels:
      full: "Names at least one concrete problem and the fix"
      partial: "Vague (\"some things were off\")"
      none: "No reflection, or \"everything was perfect\" with visible problems"
grader_notes: |
  Milestone 1 of 6 in "Bring your flow to life". In Name-Screen (their Sandbox folder): 3–4 mobile screens of one
  task, built from instances of their Name-DS-template library, most likely with /ds-screens. Last time's screen
  can be the first screen. Check a few layers: instances, not detached frames; real copy.
  Common mistakes: screens that don't belong to one task, detached instances after Claude edited them, placeholder
  text, a flow built in the library file instead of Name-Screen. If the link can't be opened: confidence low, flag
  figma_inaccessible.
---
Grow last time's screen into a short flow: 3 or 4 screens of one task.

**Name** always means your own name, for example **Alvis-Screen**.

### What to do
1. Open **Name-Screen** in your Sandbox folder. Your screen from last time can be the first screen.
2. Pick one task, for example **welcome → log in → home** or **accounts → account → transfer**.
3. Build the other 2 or 3 screens with **/ds-screens**, only from your **Name-DS-template** library.
4. Place the screens left to right, in order.

![Three login screens built from the design system, side by side](/challenges/motion-flow-screens.png)

**Tip: let Claude Code build it.** Open a Claude Code chat in your **Documents/UXDA-DS/Name-DS-template** folder, run **/harvest**, then:

> /ds-screens In my Name-Screen file (link), build a 3-screen login flow: welcome, log in, home. Use only components from my Name-DS-template library. Start from my existing screen.

### Check it yourself
1. Click through a few layers: real instances, nothing detached?
2. Real copy on every screen, no "Label" or Lorem ipsum?
3. Fix what's wrong.

### What to send
- The link to the flow in **Name-Screen**.
- A screenshot of the whole flow.
- What Claude got wrong, and what you changed.
