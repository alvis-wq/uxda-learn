---
slug: verify-before-you-trust
title: Verify before you trust
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
      An AI-written handoff annotation under "Logic & behavior" says: "Card freeze is instant and
      can be reversed at any time." Nobody has confirmed this with the client. Where does it belong
      until they do?
    options:
      - { id: a, label: "Logic & behavior, as written" }
      - { id: b, label: Assumptions (or Open questions) until it's confirmed }
      - { id: c, label: "Purpose & trigger" }
      - { id: d, label: Nowhere — delete it }
    answer: b
    points: 2
  - id: q2
    kind: multi
    prompt: Before relying on an AI summary of a 40-page client brief, which checks are worth doing? Select all that apply.
    options:
      - { id: a, label: Spot-check a few specific claims against the source pages }
      - { id: b, label: Check that every constraint the brief marks as mandatory appears in the summary }
      - { id: c, label: Ask the AI to rate its confidence and skip checks if it says "high" }
      - { id: d, label: "Check names, numbers and dates against the original" }
    answer: [a, b, d]
    points: 2
  - id: q3
    kind: single
    prompt: >-
      The AI generates this error state for a failed card freeze: "Something went wrong. Please
      try again." What's the main problem?
    options:
      - { id: a, label: It's too long for a mobile screen }
      - { id: b, label: It should sound more friendly }
      - { id: c, label: Freeze actions don't need an error state }
      - { id: d, label: "It doesn't say whether the card is frozen or not, or what to do if retrying fails" }
    answer: d
    points: 3
  - id: q4
    kind: single
    prompt: When is a light check of AI output reasonable?
    options:
      - { id: a, label: When it looks polished and consistent }
      - { id: b, label: When it's going straight to the client }
      - { id: c, label: "When it's a cheap, early exploration you'll iterate on or throw away anyway" }
      - { id: d, label: When the AI says it's confident }
    answer: c
    points: 3
---
## Verify before you trust
How much checking does AI output need, and what kind? Four quick questions about verifying
summaries, annotations and generated states before they reach anyone else.

About 5 minutes. Answers are checked automatically when you submit.
