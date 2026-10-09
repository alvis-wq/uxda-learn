---
slug: same-brief-three-tools
title: Same brief, three tools
category: wireframing
type: screenshot
difficulty: 2
points: 30
estimated_minutes: 120
status: published
submission:
  screenshots:
    min: 3
    max: 9
    label: At least one screenshot of the flow from each tool (Claude Design, Figma Make, Claude Code)
  reflection:
    required: true
    min_words: 150
    prompt: >-
      For each tool: what was it good at, what did it get wrong, and how long did it take
      (and roughly what did it cost)? What did you have to fix by hand? Which tool would you
      use at which stage of a real project, and why?
rubric:
  - id: tool-fit
    criterion: Explains what each tool is good and bad at, with concrete examples from their own screens
    points: 10
    levels:
      full: Specific strengths and weaknesses for all three tools, each tied to something visible in the screenshots
      partial: Generic statements, or only one or two tools covered with real examples
      none: Missing, or unrelated to the screens submitted
  - id: coverage
    criterion: The same card freeze/unfreeze flow (4–5 screens) is built in all three tools
    points: 8
    levels:
      full: All three tools show the freeze and unfreeze paths with comparable scope (4–5 screens each)
      partial: One tool missing, or the flows differ so much they can't be compared
      none: Only one tool used, or a different brief
  - id: time-cost
    criterion: Compares time and cost per tool with actual numbers
    points: 6
    levels:
      full: Time (and cost or usage) noted per tool, with a conclusion about where each is worth it
      partial: Rough impressions without numbers, or numbers without a conclusion
      none: No time or cost comparison
  - id: ai-critique
    criterion: Identifies what the AI got wrong and what they changed
    points: 6
    levels:
      full: Names specific AI mistakes (e.g. missing state, off-library element, wrong assumption) and what they did about each
      partial: Says "it needed some fixes" without specifics
      none: Claims the output was fine as generated, or doesn't address it
grader_notes: |
  Strong answers: see the tools as stage-specific. Claude Design / Figma Make for fast,
  cheap iteration on structure; Claude Code (uxda-wireframes plugin) for the final pass —
  library connection, /check, /format and handoff annotations. A strong reflection says
  something like "I wouldn't start in Claude Code" with a reason grounded in their screens.
  Watch for:
  - Screenshots from only one or two tools, or three near-identical screenshots relabelled.
  - Flows that skip unfreeze, or never show the confirmation / result state.
  - Time/cost reported as "fast" or "cheap" with no numbers → time-cost partial at best.
  - "All three worked well" with no AI mistakes found → ai-critique partial at best
    (per calibration rules, an unedited AI result with no problems found is never full).
---
## Goal
Learn which wireframing tool fits which stage by building the **same flow three times**.

## The brief
A retail banking app needs a **card freeze / unfreeze** flow, 4–5 screens:
the card overview, the freeze action, a confirmation step, the frozen state, and the way back
(unfreeze). Use realistic copy, not lorem ipsum.

## What to do
1. Build the flow in **Claude Design** using the UXDA wireframe design system.
2. Build it again in **Figma Make** using the UXDA Make Kit.
3. Build it a third time with **Claude Code** and the uxda-wireframes plugin
   (`/new-flow`, then `/check` and `/format`).
4. Keep a rough log as you go: time spent per tool and roughly what it cost (credits, usage).
5. Fix anything the AI got wrong — and note what it was.

## What to submit
- Screenshots of the flow from **each** tool (at least one per tool).
- A reflection: strengths and weaknesses, time and cost per tool, what you fixed, and which tool
  you'd use at which stage.

**Time:** about 2 hours.
