---
slug: wfc-2-work-with-the-skills
title: "Work with the skills"
category: wireframing
audiences: [strategist]
path: wireframe-framework-check
type: quiz
feedback_mode: instant
difficulty: 1
points: 8
estimated_minutes: 10
status: draft
questions:
  - id: q7
    kind: single
    prompt: "You are working on two flows at the same time: Cards and Payments. How do you organize your Claude chats?"
    options:
      - { id: a, label: "One chat for both, so Claude knows the whole project" }
      - { id: b, label: "One chat per flow, inside the Claude project, each renamed after its flow" }
      - { id: c, label: "A new chat for every step" }
      - { id: d, label: "Chats outside the project, so they stay separate from research" }
    answer: b
    explanation: "One chat per screen or flow keeps the context clean."
    points: 2
  - id: q8
    kind: single
    prompt: "/wf-insights finishes and reports: \"Evidence for this screen was thin; 2 of 6 insights come from one interview.\" What do you do?"
    options:
      - { id: a, label: "Move on, since Claude already filled the board" }
      - { id: b, label: "Check those insights against the source, add what you know, and consider adding sources before moving on" }
      - { id: c, label: "Delete all insights and write them yourself" }
      - { id: d, label: "Run the skill again until the warning disappears" }
    answer: b
    explanation: "Claude's report is an early warning — check before you move on."
    points: 2
  - id: q9
    kind: single
    prompt: "If Claude's output looks well written, you can move to the next step without checking it, because the skills follow UXDA's rules."
    options:
      - { id: "true", label: "True" }
      - { id: "false", label: "False" }
    answer: "false"
    explanation: "You are responsible for the result, not the AI. Every output gets checked."
    points: 2
  - id: q10
    kind: single
    prompt: "A skill keeps asking for information you already gave, which slows you down. What do you do?"
    options:
      - { id: a, label: "Stop using the skill" }
      - { id: b, label: "Work around it and say nothing" }
      - { id: c, label: "Add an entry to the Feedback log with the step, skill, what happened, and what you expected" }
      - { id: d, label: "Write your own prompt instead" }
    answer: c
    explanation: "The Feedback log is how the framework gets better."
    points: 2
---
Four questions on working with the skills.
