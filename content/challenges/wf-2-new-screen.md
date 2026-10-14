---
slug: wf-2-new-screen
title: Build a screen with /new-screen
category: wireframing
type: figma
difficulty: 1
points: 10
estimated_minutes: 20
status: draft
tip: >-
  /new-screen asks you questions step by step. Answer them like you would brief a colleague —
  short and specific.
submission:
  figma_url:
    required: true
    label: Link to your new screen in Figma (anyone at UXDA must be able to open it)
  reflection:
    required: true
    min_words: 5
    prompt: What's better, and what's worse, than your Make Kit draft?
rubric:
  - id: screen
    criterion: A savings-goal screen built with /new-screen from the UXDA library
    points: 6
    levels:
      full: Screen is built from library components (not detached shapes) and matches the brief
      partial: Screen exists but mostly hand-drawn, or doesn't match the brief
      none: No screen, or the link doesn't open
  - id: compare
    criterion: Honest comparison with the Make Kit draft
    points: 4
    levels:
      full: Names a concrete difference in each direction
      partial: Only one side, or vague
      none: Missing
grader_notes: |
  Habit: knowing what Claude Code + the uxda-wireframes plugin adds over Make — real library
  components, ready for handoff. It costs more, so it's for the final version, not exploration.
  Check the screen uses library instances. If the link can't be opened: confidence low,
  flag figma_inaccessible.
---
## Build a screen with /new-screen
**The brief:** a banking app wants a savings goal screen. The user sees their goal, e.g. "Summer trip — €1,200", how much they've saved, and can add money.

This builds on [Quick draft with the Make Kit](/challenges/wf-1-make-kit-quick-draft). Same brief, new tool:
this time you build the screen in Figma with **Claude Code** and our **uxda-wireframes** plugin,
using real library components.

### What to do
1. Open Claude Code and run **/new-screen**.
2. Answer its questions to build the savings-goal screen.
3. Look at the result in Figma.

### What to send
- The **link** to the screen in Figma.
- **A short note:** how it compares with your Make Kit draft.
