---
slug: bad-order
title: Bad order
category: basics
type: quiz
difficulty: 1
points: 5
questions:
  - id: q1
    kind: order
    prompt: Same ids.
    items: [{ id: a, label: First }, { id: a, label: Second }]
    points: 2
  - id: q2
    kind: order
    prompt: Same labels.
    items: [{ id: a, label: Same }, { id: b, label: " same " }]
    points: 3
---
Body.
