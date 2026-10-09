---
slug: e2e-quiz
title: "[E2E] Quiz"
category: e2e-tests
type: quiz
difficulty: 1
points: 10
status: published
questions:
  - id: q1
    kind: single
    prompt: Which colour is the UXDA accent?
    options:
      - { id: a, label: Green }
      - { id: b, label: Lavender }
    answer: b
    points: 4
  - id: q2
    kind: multi
    prompt: Pick the even numbers.
    options:
      - { id: a, label: "2" }
      - { id: b, label: "3" }
      - { id: c, label: "4" }
    answer: [a, c]
    points: 6
---
E2E fixture quiz.
