---
slug: e2e-instant
title: "[E2E] Instant quiz"
category: e2e-tests
type: quiz
feedback_mode: instant
difficulty: 1
points: 6
help_link:
  url: "https://example.com/playbook"
  label: "the E2E Playbook"
status: published
questions:
  - id: pick
    kind: single
    prompt: Which letter comes second?
    options: [{ id: a, label: Alpha }, { id: b, label: Bravo }, { id: c, label: Charlie }]
    answer: b
    explanation: B is the second letter.
    points: 2
  - id: pairs
    kind: match
    prompt: Match each file to its purpose.
    categories:
      - { id: guide, label: "The guide: what to do" }
      - { id: work, label: Where the work goes }
    items:
      - { id: framework, label: Framework, match: guide }
      - { id: workspace, label: Workspace, match: work }
    explanation: The framework guides, the workspace holds the work.
    points: 2
  - id: tf
    kind: single
    prompt: Every output gets checked.
    options: [{ id: "true", label: "True" }, { id: "false", label: "False" }]
    answer: "true"
    explanation: You are responsible for the result.
    points: 2
---
A short instant-feedback quiz used by the E2E suite.
