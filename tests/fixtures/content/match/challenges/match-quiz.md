---
slug: match-quiz
title: Match quiz
category: basics
type: quiz
feedback_mode: instant
difficulty: 1
points: 6
questions:
  - id: files
    kind: match
    prompt: Match each file to its purpose.
    categories:
      - { id: guide, label: "The guide: what to do" }
      - { id: work, label: Where the work goes }
      - { id: log, label: Where feedback goes }
    items:
      - { id: framework, label: Framework, match: guide }
      - { id: workspace, label: Workspace, match: work }
      - { id: feedback, label: Feedback log, match: log }
    explanation: The framework guides, the workspace holds the work.
    points: 2
  - id: sort
    kind: match
    prompt: Put each tool in its group.
    categories:
      - { id: design, label: Design }
      - { id: code, label: Code }
    items:
      - { id: figma, label: Figma, match: design }
      - { id: make, label: Figma Make, match: design }
      - { id: claude-code, label: Claude Code, match: code }
    points: 2
  - id: tf
    kind: single
    prompt: Every output gets checked.
    options: [{ id: "true", label: "True" }, { id: "false", label: "False" }]
    answer: "true"
    explanation: You are responsible for the result.
    points: 2
---
Pair things up.
