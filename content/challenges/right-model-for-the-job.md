---
slug: right-model-for-the-job
title: Pick the right model
category: ai-workflow
type: quiz
difficulty: 1
points: 10
estimated_minutes: 4
status: draft
questions:
  - id: q1
    kind: single
    prompt: You need to plan a 6-week project with phases, risks and who does what. Which do you pick?
    options:
      - { id: a, label: "Sonnet 5.5, medium effort" }
      - { id: b, label: "Opus 5.5, high effort" }
      - { id: c, label: "Haiku 5.5" }
      - { id: d, label: "Doesn't matter, they all give the same result" }
    answer: b
    points: 2
  - id: q2
    kind: single
    prompt: You want Claude to make a client email shorter and friendlier. Which do you pick?
    options:
      - { id: a, label: "Opus 5.5 on high effort, just to be safe" }
      - { id: b, label: "Sonnet 5.5 — fast and good at simple, clear tasks" }
      - { id: c, label: "Always the strongest model, for everything" }
      - { id: d, label: "Don't use AI for emails" }
    answer: b
    points: 2
  - id: q3
    kind: single
    prompt: What happens when you set a higher effort?
    options:
      - { id: a, label: "Claude thinks longer. Better for hard problems, but slower and uses more of your limit" }
      - { id: b, label: "Claude writes longer answers" }
      - { id: c, label: "Claude switches to a newer model" }
      - { id: d, label: "Nothing really changes" }
    answer: a
    points: 2
  - id: q4
    kind: single
    prompt: Claude has tried twice and keeps going in circles. What do you do?
    options:
      - { id: a, label: "Send the same message again" }
      - { id: b, label: "Give up — AI can't do this" }
      - { id: c, label: "Switch to Opus or a higher effort, and tell it what you already tried" }
      - { id: d, label: "Tell it to try harder" }
    answer: c
    points: 2
  - id: q5
    kind: single
    prompt: A chat has gone on for hours about three different topics, and Claude starts mixing things up. What helps?
    options:
      - { id: a, label: "Keep going in the same chat" }
      - { id: b, label: "Start a new chat and paste a short summary of what matters" }
      - { id: c, label: "Switch to a smaller model" }
      - { id: d, label: "Write your question in capital letters" }
    answer: b
    points: 2
---
## Pick the right model
The model and effort you choose change how fast you get an answer, how good it is, and how quickly
you use up your limit.

**Simple rule:** use Opus for planning and hard thinking. Use Sonnet for clear, everyday tasks.
Turn effort up only when the problem is hard.

5 questions, about 4 minutes.
