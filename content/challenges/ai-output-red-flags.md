---
slug: ai-output-red-flags
title: Red flags in AI output
category: ai-workflow
type: quiz
difficulty: 1
points: 10
estimated_minutes: 5
status: draft
questions:
  - id: q1
    kind: single
    prompt: >-
      Claude summarises a client interview and includes a precise statistic ("72% of users
      abandon at KYC") that you can't find anywhere in the transcript. What's the right move?
    options:
      - { id: a, label: Keep it — the number is plausible for onboarding drop-off }
      - { id: b, label: Remove it or mark it as unverified until you find a source }
      - { id: c, label: "Round it to \"about 70%\" so it sounds less precise" }
      - { id: d, label: Ask Claude to confirm the number is correct }
    answer: b
    points: 2
  - id: q2
    kind: multi
    prompt: Which of these are red flags that an AI-generated wireframe flow needs a closer look? Select all that apply.
    options:
      - { id: a, label: Every screen shows only the happy path }
      - { id: b, label: "An annotation states an assumption as fact (\"Users always have a card linked\")" }
      - { id: c, label: Components use the exact names from the UXDA library }
      - { id: d, label: A back button exists but leads nowhere in the flow }
    answer: [a, b, d]
    points: 2
  - id: q3
    kind: single
    prompt: You ask Claude to review its own output for mistakes and it replies "No issues found." What does that tell you?
    options:
      - { id: a, label: The output is correct }
      - { id: b, label: You should regenerate it with a different tool }
      - { id: c, label: "Very little — you still need to check it against the brief and real constraints yourself" }
      - { id: d, label: Your prompt was precise enough }
    answer: c
    points: 2
  - id: q4
    kind: single
    prompt: >-
      You push back on a layout with a regulatory constraint, and the AI immediately agrees and
      changes everything. What's the best reading?
    options:
      - { id: a, label: "Agreement isn't evidence — check the change actually meets the constraint and didn't break anything else" }
      - { id: b, label: The new version is right because it now includes your constraint }
      - { id: c, label: "The first version was wrong, so discard everything from it" }
      - { id: d, label: Pushing back on AI output wastes time }
    answer: a
    points: 2
  - id: q5
    kind: single
    prompt: What's the most reliable way to check that an AI-built flow covers the brief?
    options:
      - { id: a, label: Read through it once and see whether it feels complete }
      - { id: b, label: Check that the number of screens matches the brief }
      - { id: c, label: Ask the AI whether it covered everything in the brief }
      - { id: d, label: List the brief's requirements and tick each one against a specific screen or state }
    answer: d
    points: 2
---
## Red flags in AI output
AI tools produce work that *looks* finished. This short quiz checks whether you can spot the
signs that it isn't — and what to do about them.

Five questions, about 5 minutes. Answers are checked automatically when you submit.
