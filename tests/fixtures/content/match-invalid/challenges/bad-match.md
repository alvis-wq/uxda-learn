---
slug: bad-match
title: Bad match
category: basics
type: quiz
difficulty: 1
points: 4
questions:
  - id: q1
    kind: match
    prompt: Match.
    categories:
      - { id: a, label: A }
      - { id: a, label: Same }
    items:
      - { id: x, label: X, match: a }
      - { id: x, label: x, match: nowhere }
    points: 2
  - id: q2
    kind: match
    prompt: Match.
    categories:
      - { id: a, label: Twin }
      - { id: b, label: twin }
    items:
      - { id: x, label: X, match: a }
      - { id: y, label: Y, match: b }
    points: 2
---
Broken on purpose.
