---
slug: wfc-3-judgment-calls
title: "Judgment calls"
category: wireframing
audiences: [strategist]
path: wireframe-framework-check
type: quiz
feedback_mode: instant
difficulty: 1
points: 10
estimated_minutes: 10
help_link:
  url: "https://www.figma.com/design/LGZoFgcZNZPl72DDRv9n0A/UXDA-Playbook?node-id=2482-30725"
  label: "the UXDA Playbook"
status: draft
questions:
  - id: q11
    kind: single
    prompt: "The project has no research on family accounts. What do you do before running /wf-insights?"
    options:
      - { id: a, label: "Provide sources (client brief, competitor apps, articles) or add research to the project" }
      - { id: b, label: "Let Claude work from general banking knowledge" }
      - { id: c, label: "Skip to Ideas" }
      - { id: d, label: "Reuse insights from another client's project" }
    answer: a
    explanation: "Insights must come from real sources, never be made up."
    points: 1.5
  - id: q12
    kind: single
    prompt: "Your project covers retail and business banking, and /wf-jtbd returns jobs mixing both. What do you do?"
    options:
      - { id: a, label: "Keep them all" }
      - { id: b, label: "Split them across two flows" }
      - { id: c, label: "Delete the business ones by hand" }
      - { id: d, label: "Rerun the skill, stating exactly which segment you are designing for" }
    answer: d
    explanation: "Being specific about the scope is the strategist's job."
    points: 1.5
  - id: q13
    kind: single
    prompt: "All the references you found are from one competitor. What do you do?"
    options:
      - { id: a, label: "Use them; one good source is enough" }
      - { id: b, label: "Copy that competitor's solution" }
      - { id: c, label: "Add references from other competitors and from outside banking before moving on" }
      - { id: d, label: "Skip references for this screen" }
    answer: c
    explanation: "A single source narrows your thinking."
    points: 1.5
  - id: q14
    kind: single
    prompt: "The build brief has 12 [ASSUMED] items. What do you do?"
    options:
      - { id: a, label: "Review each assumption and correct the wrong ones before building" }
      - { id: b, label: "Paste the brief into Claude Code as it is" }
      - { id: c, label: "Delete all assumptions from the brief" }
      - { id: d, label: "Ask the client to approve all 12" }
    answer: a
    explanation: "Assumptions are marked so you can quickly correct them."
    points: 1.5
  - id: q15
    kind: single
    prompt: "Claude's annotation describes a behavior that isn't actually on the screen. What do you do?"
    options:
      - { id: a, label: "Keep it; Claude probably knows the intent" }
      - { id: b, label: "Add the behavior to the screen so they match" }
      - { id: c, label: "Rerun the skill until the text changes" }
      - { id: d, label: "Correct or delete it, since annotations must describe what the screen actually does" }
    answer: d
    explanation: "Annotations describe what the screen really does."
    points: 1
  - id: q18
    kind: single
    prompt: "During handover, one element is still waiting on client input. What do you do?"
    options:
      - { id: a, label: "Leave it out of the brief" }
      - { id: b, label: "Make your own decision and hand over" }
      - { id: c, label: "Delay the whole handover until it's resolved" }
      - { id: d, label: "Flag it explicitly as pending, so the Designer doesn't treat it as settled" }
    answer: d
    explanation: "Pending items must never look settled."
    points: 1
  - id: q19
    kind: single
    prompt: "Claude's output reads well, but you can't tell where some of it came from. What do you do?"
    options:
      - { id: a, label: "Ask Claude where it came from, and remove anything it can't back up" }
      - { id: b, label: "Trust it, since it reads well" }
      - { id: c, label: "Rerun the skill" }
      - { id: d, label: "Delete the whole step" }
    answer: a
    explanation: "Every output must be traceable to a source."
    points: 1
  - id: q20
    kind: single
    prompt: "A skill keeps giving weak results for one type of screen. What do you do?"
    options:
      - { id: a, label: "Stop using the skill" }
      - { id: b, label: "Give more guidance in chat to get the result, and log it in the Feedback log" }
      - { id: c, label: "Write your own prompt instead and say nothing" }
      - { id: d, label: "Accept the weak results" }
    answer: b
    explanation: "Guide the skill now, and log it so the skill improves."
    points: 1
---
Each question describes a real situation. Choose the best action.
