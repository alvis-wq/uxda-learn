---
slug: peer-review-swap
title: Peer review swap
category: wireframing
type: figma
difficulty: 2
points: 25
estimated_minutes: 60
status: draft
submission:
  screenshots:
    min: 1
    max: 6
    label: Your review comments on your colleague's flow
  figma_url:
    required: true
    label: Link to the colleague's flow you reviewed (node URL)
  reflection:
    required: true
    min_words: 100
    prompt: >-
      What is one thing the AI got wrong that the author missed? Show where it is and explain
      why it matters. What would you tell the author to change first?
rubric:
  - id: rubric-coverage
    criterion: Review covers wireframe grammar, states, annotations and library compliance
    points: 8
    levels:
      full: All four areas reviewed, each with at least one specific observation
      partial: Two or three areas covered
      none: One area or a general impression only
  - id: specificity
    criterion: Comments are specific, located and actionable
    points: 7
    levels:
      full: Each comment points to a screen/element and says what to change
      partial: Mix of specific and vague comments
      none: Vague praise or criticism only
  - id: ai-miss
    criterion: Flags one thing the AI got wrong that the author missed, with evidence
    points: 10
    levels:
      full: A real AI error, clearly located, with why it matters and how to fix it
      partial: An issue flagged but it's not clearly an AI error, or weakly evidenced
      none: Not found or not addressed
grader_notes: |
  Needs pairing logic before publishing (who reviews whom) — keep as draft.
  Strong reviews are kind but direct, and organised by the four areas.
  The "AI miss" should be something an AI tool plausibly produced: assumption stated as fact,
  missing error/empty state, off-library element, dead-end, inconsistent terminology between
  screens. Personal taste ("I'd use a different colour") doesn't count.
  If the Figma link can't be opened: score from screenshots, confidence low, flag figma_inaccessible.
---
## Goal
Get better at reviewing by reviewing someone else's AI-assisted work — and catch what the
author didn't.

## What to do
1. You'll be paired with a colleague. Open their finished flow.
2. Review it against four areas: **wireframe grammar**, **states**, **annotations**, and
   **library compliance**. Leave comments in Figma.
3. Find **one thing the AI got wrong that the author missed**.

## What to submit
- The Figma link to the flow you reviewed.
- Screenshots of your review comments.
- A reflection on the AI miss: where it is, why it matters, what to change first.

**Time:** about 1 hour.
