---
slug: wfc-1-know-the-system
title: "Know the system"
category: wireframing
audiences: [strategist]
path: wireframe-framework-check
type: quiz
feedback_mode: instant
difficulty: 1
points: 12
estimated_minutes: 10
help_link:
  url: "https://www.figma.com/design/LGZoFgcZNZPl72DDRv9n0A/UXDA-Playbook?node-id=2482-30725"
  label: "the UXDA Playbook"
status: draft
questions:
  - id: q1
    kind: order
    prompt: "Drag the six phases into the correct order."
    items:
      - { id: research-definition, label: "Research & definition" }
      - { id: references-inspiration, label: "References & inspiration" }
      - { id: uxda-factor, label: "UXDA factor" }
      - { id: build-and-describe, label: "Build and describe" }
      - { id: deliver, label: "Deliver" }
      - { id: refine-hand-over, label: "Refine & hand over" }
    explanation: "These are the six phases of the framework."
    points: 2
  - id: q2
    kind: order
    prompt: "Drag these steps into the order you complete them."
    items:
      - { id: insights, label: "Insights" }
      - { id: jobs-to-be-done, label: "Jobs to be done" }
      - { id: key-user-scenarios, label: "Key user scenarios" }
      - { id: references-inspiration, label: "References & inspiration" }
      - { id: strategic-direction, label: "Strategic direction" }
      - { id: ideas, label: "Ideas" }
      - { id: structure-draft, label: "Structure draft" }
      - { id: build, label: "Build" }
    explanation: "Steps 1 to 8 — each one builds on the previous ones."
    points: 2
  - id: q3
    kind: match
    prompt: "Match each file to its purpose."
    categories:
      - { id: c1, label: "The guide: what to do in each step, why, quality criteria, and which skill to use" }
      - { id: c2, label: "Where you and Claude fill in the work for each step" }
      - { id: c3, label: "Where you report problems and suggestions about the framework and skills" }
    items:
      - { id: wireframe-creation-framework, label: "Wireframe creation framework", match: c1 }
      - { id: wireframe-workspace, label: "Wireframe workspace", match: c2 }
      - { id: feedback-log, label: "Feedback log", match: c3 }
    explanation: "The framework guides you, the workspace holds the work, and the feedback log improves both."
    points: 2
  - id: q4
    kind: single
    prompt: "Where should you fill in the workspace for a client project?"
    options:
      - { id: a, label: "Directly in the template in the Wireframe creation system file" }
      - { id: b, label: "In a copy of the workspace placed in the client's internal file" }
      - { id: c, label: "In a new blank Figma file" }
      - { id: d, label: "In the Claude chat only" }
    answer: b
    explanation: "Never fill in the template itself — always work in a copy in the client's file."
    points: 2
  - id: q5
    kind: match
    prompt: "Match each skill to its step."
    categories:
      - { id: c1, label: "Insights" }
      - { id: c2, label: "Jobs to be done" }
      - { id: c3, label: "Key user scenarios" }
      - { id: c4, label: "References & inspiration" }
      - { id: c5, label: "Strategic direction" }
      - { id: c6, label: "Ideas" }
      - { id: c7, label: "Structure draft" }
      - { id: c8, label: "Add annotations" }
      - { id: c9, label: "Review" }
    items:
      - { id: wf-insights, label: "/wf-insights", match: c1 }
      - { id: wf-jtbd, label: "/wf-jtbd", match: c2 }
      - { id: wf-scenarios, label: "/wf-scenarios", match: c3 }
      - { id: wf-references, label: "/wf-references", match: c4 }
      - { id: wf-direction, label: "/wf-direction", match: c5 }
      - { id: wf-ideas, label: "/wf-ideas", match: c6 }
      - { id: wf-structure, label: "/wf-structure", match: c7 }
      - { id: wf-annotations, label: "/wf-annotations", match: c8 }
      - { id: wf-review, label: "/wf-review", match: c9 }
    explanation: "One skill per step, from Insights to Review."
    points: 2
  - id: q6
    kind: single
    prompt: "Which steps use the UXDA wireframe plugin in Claude Code instead of a /wf- skill?"
    options:
      - { id: a, label: "Insights and Jobs to be done" }
      - { id: b, label: "Build and Naming, formatting & publishing" }
      - { id: c, label: "Ideas and Strategic direction" }
      - { id: d, label: "Review and Handover" }
    answer: b
    explanation: "Build uses /new-screen, /new-flow and /check; formatting uses /format."
    points: 2
---
Six questions on the framework: its phases and steps, its files, and which skill or plugin to use for each step.
