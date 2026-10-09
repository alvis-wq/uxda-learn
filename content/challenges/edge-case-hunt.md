---
slug: edge-case-hunt
title: Edge case hunt
category: wireframing
type: mixed
difficulty: 2
points: 30
estimated_minutes: 90
status: published
questions:
  - id: q1
    kind: text
    prompt: >-
      List every missing state you found in the happy-path flow (empty, loading, error,
      partial data, timeout, permission denied, and anything else). For each, name the screen
      it belongs to.
    min_words: 60
    points: 10
submission:
  screenshots:
    min: 2
    max: 6
    label: The original happy path, and the 3 states you designed
  figma_url:
    required: false
    label: Link to the frame(s) with your new states (optional)
  reflection:
    required: true
    min_words: 80
    prompt: >-
      Why these 3 states? What did the AI miss in the original flow, and when you asked it to
      help design the states, what did it get wrong that you changed?
rubric:
  - id: state-quality
    criterion: The 3 designed states are complete and useful
    points: 10
    levels:
      full: Each state says what happened, what it means for the user, and how to recover or continue
      partial: States exist but lack a recovery path or clear message
      none: Fewer than 3 states, or only generic placeholders
  - id: prioritisation
    criterion: Picks the 3 most important states and explains why
    points: 5
    levels:
      full: Choice is justified by likelihood and impact on the user (e.g. money at risk, blocked task)
      partial: Reasonable picks without justification
      none: Arbitrary picks
  - id: ai-critique
    criterion: Identifies what the AI missed or got wrong and what they changed
    points: 5
    levels:
      full: Specific omissions or errors and the concrete change made
      partial: General statement that the AI missed states
      none: Not addressed
grader_notes: |
  A strong q1 list is systematic: walks each screen and asks empty / loading / error / partial /
  timeout / permission. 6+ relevant states across the flow is strong; 3 or fewer is weak.
  Score q1 roughly 1–2 pts per relevant, correctly placed state, max 10.
  Prioritisation: in fintech, states where money or access is at stake (payment failed,
  session timeout mid-transfer, permission denied for camera during KYC) usually outrank
  cosmetic empty states.
  Common mistakes: error state "Something went wrong. Try again." with no context or recovery;
  loading states for instant actions; designing states the flow already had.
---
## Goal
Train the habit of asking "what else can happen here?" — AI tools mostly draw the happy path.

## What to do
1. Take an AI-generated happy-path flow (your own from Claude Design or Make, or any recent
   one from a project).
2. Walk every screen and list **every missing state**: empty, loading, error, partial data,
   timeout, permission denied — and anything else you spot.
3. Pick the **3 most important** and design them. You can use the AI to help, but check and fix
   what it gives you.

## What to submit
- Your list of missing states.
- Screenshots of the original happy path and your 3 new states.
- A reflection: why these 3, and what the AI missed or got wrong.

**Time:** about 90 minutes.
