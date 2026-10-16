---
slug: verify-before-you-trust
title: Check before you trust
category: ai-workflow
type: quiz
difficulty: 1
points: 10
estimated_minutes: 4
status: published
image: verify-before-you-trust.png
questions:
  - id: q1
    kind: single
    prompt: Claude's summary of a client call says "72% of users drop off at KYC." You can't find this number in the transcript. What do you do?
    options:
      - { id: a, label: "Keep it — it sounds right" }
      - { id: b, label: "Remove it, or mark it as \"not confirmed\" until you find where it came from" }
      - { id: c, label: "Change it to \"about 70%\"" }
      - { id: d, label: "Ask Claude if it's correct" }
    answer: b
    points: 3
  - id: q2
    kind: multi
    prompt: Claude summarised a 40-page client brief for you. What should you check before using it? Pick all that apply.
    options:
      - { id: a, label: "Compare a few points with the original pages" }
      - { id: b, label: "Check that every must-have from the brief is in the summary" }
      - { id: c, label: "Ask Claude how confident it is, and skip checking if it says \"very\"" }
      - { id: d, label: "Check names, numbers and dates against the original" }
    answer: [a, b, d]
    points: 3
  - id: q3
    kind: single
    prompt: Claude writes a client email that says "As agreed on Friday's call, delivery moves to the 15th." You don't remember agreeing to that. What do you do?
    options:
      - { id: a, label: "Send it — Claude had the context" }
      - { id: b, label: "Check your notes or ask a colleague who was on the call. If you can't confirm it, remove it" }
      - { id: c, label: "Change it to the 16th to be safe" }
      - { id: d, label: "Send it and fix it if the client complains" }
    answer: b
    points: 2
  - id: q4
    kind: single
    prompt: When is a quick look at Claude's work enough?
    options:
      - { id: a, label: "When it looks polished" }
      - { id: b, label: "When it's going straight to a client" }
      - { id: c, label: "When it's an early draft you'll change or throw away anyway" }
      - { id: d, label: "When Claude says it's confident" }
    answer: c
    points: 2
---
## Check before you trust
Work from AI often *looks* finished. How much should you check before it goes to a client or a
colleague?

4 questions, about 4 minutes.
