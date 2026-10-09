---
slug: handoff-only-round
title: Handoff-only round
category: wireframing
type: figma
difficulty: 3
points: 50
estimated_minutes: 150
status: published
submission:
  screenshots:
    min: 2
    max: 8
    label: The flow before and after the Claude Code pass, and your rewritten annotations
  figma_url:
    required: true
    label: Link to the final flow frame (node URL)
  reflection:
    required: true
    min_words: 150
    prompt: >-
      For each annotation category, show the AI's version and your rewrite, and explain why
      yours is better. What else did the AI get wrong in the final pass, and what did you change?
rubric:
  - id: workflow-discipline
    criterion: Iterates in Claude Design or Make first and uses Claude Code only for the final pass
    points: 10
    levels:
      full: Clear evidence of earlier iteration in Claude Design/Make; Claude Code used only for library, /check, /format and annotations
      partial: Workflow mostly followed but Claude Code also used for layout work
      none: Built mainly in Claude Code, or no evidence of the workflow
  - id: library-and-check
    criterion: Flow is connected to the Figma library and /check issues are resolved or explained
    points: 12
    levels:
      full: Library components throughout; every /check issue fixed or explicitly justified
      partial: Some off-library elements or unexplained /check issues remain
      none: Not connected to the library, or /check not run
  - id: annotation-rewrites
    criterion: At least one AI annotation rewritten per category (Purpose & trigger, Logic & behavior, Assumptions, Open questions), each clearly better
    points: 16
    levels:
      full: All four categories rewritten; rewrites are specific, testable and correctly categorised
      partial: Two or three categories, or rewrites that are only rephrased
      none: Fewer than two categories, or no real change
  - id: ai-critique
    criterion: Explains why the rewrites are better and what else the AI got wrong
    points: 12
    levels:
      full: Concrete reasons per rewrite (ambiguity removed, assumption surfaced, wrong category fixed) plus other AI errors found
      partial: Reasons given for some rewrites only, or generic
      none: No explanation
grader_notes: |
  Intended workflow: iterate in Claude Design / Make, then Claude Code + uxda-wireframes only
  at the end for library connection, /check, /format and handoff commentary.
  Annotation categories: Purpose & trigger, Logic & behavior, Assumptions, Open questions.
  Typical AI annotation problems a strong learner fixes:
  - Assumptions written as facts under Logic & behavior.
  - Vague logic ("validates input") with no rule, limits or error behaviour.
  - Open questions that are really decisions the team should make, or are missing entirely.
  - Purpose restating the screen title instead of the user's trigger/goal.
  If the Figma link can't be opened: score from screenshots only, confidence low,
  flag figma_inaccessible.
  Red flags: rewrites that only change wording; screenshots without the before state.
---
## Goal
Practise the intended workflow end to end — and own the handoff, rather than shipping the
AI's annotations as they are.

## What to do
1. Build or take a flow you iterated on in **Claude Design** or **Figma Make**.
2. Bring it into Figma.
3. Use **Claude Code** with the uxda-wireframes plugin **only for the final pass**:
   connect to the Figma library, run `/check`, run `/format`, and generate the handoff
   commentary.
4. Review the generated annotations. **Rewrite at least one per category**:
   Purpose & trigger, Logic & behavior, Assumptions, Open questions.

## What to submit
- The Figma node URL of the final flow.
- Screenshots of before/after the Claude Code pass and of your rewritten annotations.
- A reflection: for each rewrite, why yours is better, and what else the AI got wrong.

**Time:** about 2.5 hours.
