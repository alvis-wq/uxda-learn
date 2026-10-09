---
slug: spot-the-plant
title: Spot the plant
category: wireframing
type: mixed
difficulty: 3
points: 50
estimated_minutes: 90
status: draft
questions:
  - id: q1
    kind: text
    prompt: >-
      List every problem you found BEFORE running /check. For each one: the screen, what is
      wrong, and why it matters for the user or for handoff.
    min_words: 80
    points: 20
submission:
  screenshots:
    min: 1
    max: 4
    label: The /check output after you ran it
  figma_url:
    required: false
    label: Link to your copy of the file with your findings marked (optional)
  reflection:
    required: true
    min_words: 120
    prompt: >-
      Compare your list with /check. What did /check catch that you missed, and what did you
      catch that /check missed? What does this tell you about trusting an AI-built flow that
      looks finished?
rubric:
  - id: check-comparison
    criterion: Honest, specific comparison between their manual findings and /check output
    points: 12
    levels:
      full: Lists which issues each found, including what both missed, with screen references
      partial: General comparison ("check found a couple more") without specifics
      none: No comparison, or the manual list was clearly written after running /check
  - id: impact
    criterion: Explains why each issue matters for the user or for handoff
    points: 10
    levels:
      full: Each issue has a concrete consequence (user stuck, dev builds wrong thing, library drift)
      partial: Consequences for some issues only, or generic ("bad UX")
      none: Issues listed without any reasoning
  - id: ai-trust
    criterion: Draws a usable conclusion about reviewing AI-built flows
    points: 8
    levels:
      full: A specific review habit they'll apply next time, grounded in what they missed
      partial: Generic "always double-check AI"
      none: Not addressed
grader_notes: |
  TODO_FIGMA_URL — Alvis provides the seeded Figma file before this is published.
  Seeded errors (answer key — update screen names once the file exists):
  1. Detached component — an instance detached from the library (looks right, isn't linked).
  2. Off-library element — a hand-drawn element where a library component exists.
  3. Missing error state — a step that can fail has no error/failure screen.
  4. Dead-end screen — a screen with no way forward or back.
  5. Broken back path — "Back" leads to the wrong screen or nowhere.
  6. Assumption written as fact — an annotation states an unconfirmed assumption as behaviour
     (belongs under Assumptions / Open questions).
  Scoring q1 (20 pts): ~3 pts per seeded error correctly found and located (max 18), +2 for
  clear "why it matters" across the list. Real issues beyond the seeded six are fine but don't
  add points beyond 20. False positives presented confidently: −1 each (min 0).
  /check is expected to catch the library issues (1, 2) more reliably than the logic issues
  (3–6). A strong reflection notices that.
  Red flags: q1 list that mirrors /check output word for word (possible after-the-fact list →
  check-comparison none, confidence low).
---
## Goal
Practise **review, don't trust**. This flow looks finished. It isn't.

## The file
Open the seeded file: TODO_FIGMA_URL — duplicate it to your drafts first.

It's an AI-built flow with **5–6 planted errors** — the kind AI tools actually make: things
that look right at a glance but break in use or in handoff.

## What to do
1. Review the whole flow **without running `/check`**. Click through it as a user would, then
   look at it as a developer would.
2. Write down every problem you find (screen, what's wrong, why it matters).
3. **Then** run `/check` from the uxda-wireframes plugin and screenshot the output.
4. Compare the two lists.

## What to submit
- Your list of problems found before `/check`.
- A screenshot of the `/check` output.
- A reflection comparing the two, and what it means for trusting AI-built flows.

**Time:** about 90 minutes.
