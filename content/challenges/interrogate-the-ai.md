---
slug: interrogate-the-ai
title: Interrogate the AI
category: wireframing
type: screenshot
difficulty: 2
points: 25
estimated_minutes: 60
status: published
submission:
  screenshots:
    min: 2
    max: 8
    label: The conversation — your "why" question, its answer, your pushback and its response
  reflection:
    required: true
    min_words: 100
    prompt: >-
      Where did the AI hold its position with good reasons, where did it cave too easily, and
      where was it simply wrong? What would you actually do with the design now, and why?
rubric:
  - id: question-quality
    criterion: Asks the AI to justify a specific layout or component choice
    points: 6
    levels:
      full: Targets one concrete decision ("why a bottom sheet for confirmation?") and asks for reasons
      partial: Asks a broad question ("is this good?")
      none: No real question asked
  - id: real-constraint
    criterion: Pushes back with a real, specific constraint
    points: 7
    levels:
      full: A concrete constraint (regulatory, edge case, returning user) stated precisely enough to test the design
      partial: Vague pushback ("make it more user friendly")
      none: No pushback
  - id: judgment
    criterion: Correctly judges where the AI held, caved or was wrong, with evidence from the conversation
    points: 8
    levels:
      full: Each judgment points to a specific message, and the judgment is right
      partial: Judgments made but not backed by the conversation, or partly wrong
      none: Takes the AI's final answer at face value
  - id: decision
    criterion: States what they would actually do with the design
    points: 4
    levels:
      full: A clear decision with reasoning that doesn't just defer to the AI
      partial: Decision without reasoning
      none: No decision
grader_notes: |
  The key insight: agreement is not evidence. An AI that immediately rewrites everything when
  challenged has "caved"; a strong learner checks whether the new version actually satisfies
  the constraint and didn't break something else.
  Good constraints: PSD2/SCA step-up for a payment, accessibility (screen reader order),
  returning user mid-flow, partial data (no card linked yet), low connectivity.
  Weak: "make it more modern", "simplify".
  Watch for screenshots that only show the final design, not the conversation → evidence
  missing, confidence low.
---
## Goal
Learn to question AI design decisions instead of accepting or rejecting them wholesale.

## What to do
1. In **Claude Design**, generate (or open) a screen or short flow.
2. Pick one specific layout or component choice and ask the AI **why** it made it.
3. Push back with a **real constraint** — for example a regulatory requirement, an edge case,
   or a returning user who is halfway through the task.
4. Keep going until you can tell whether the AI's reasoning held up.

## What to submit
- Screenshots of the conversation: your question, its answer, your pushback, its response.
- A reflection: where it held, where it caved too easily, where it was wrong — and what you'd
  actually do.

**Time:** about 1 hour.
