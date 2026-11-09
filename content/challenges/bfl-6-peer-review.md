---
slug: bfl-6-peer-review
title: Review a colleague's flow
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: mixed
difficulty: 2
points: 10
estimated_minutes: 30
waiting_minutes: 5
status: draft
submission:
  figma_url:
    required: true
    label: Link to your colleague's flow, where your comments are (anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 4
    label: Your comments in their file, and the /ds-lint result you ran on it
  reflection:
    required: true
    min_words: 20
    prompt: Whose flow did you review, and what is the one thing you'd copy from it into your own?
rubric:
  - id: comments
    criterion: "At least 3 specific comments in the colleague's file"
    points: 4
    levels:
      full: "3 or more comments pinned to the layer they're about, each saying what and why"
      partial: "Fewer than 3, or vague (\"looks good\", \"fix this\")"
      none: "No comments"
  - id: coverage
    criterion: "Comments cover structure and motion"
    points: 3
    levels:
      full: "At least one on naming or lint, and one on motion (standard, profile, animated data)"
      partial: "Only one of the two"
      none: "Neither"
  - id: reflection
    criterion: "Names the colleague and one thing worth copying"
    points: 3
    levels:
      full: "A concrete thing from their flow and why it's better"
      partial: "Vague"
      none: "No reflection"
grader_notes: |
  Milestone 6 of 6 in "Bring your flow to life", the final boss. They review another designer's finished flow (their
  Name-Screen prototype): run /ds-lint on it (read-only, they don't fix anything), play it, and leave at least 3
  Figma comments pinned to layers. Good comments are specific: "header is Frame 8 here and header on screen 2, so it
  fades instead of moving", "the balance animates, the standard says data stays still", "Playful feels off for a
  bank". They must not edit the colleague's file.
  Common mistakes: fixing the colleague's file instead of commenting, generic praise, reviewing their own flow.
---
The final boss: review a colleague's finished flow the way a lead would.

### What to do
1. Pick a colleague who has finished milestone 5, and open their prototype and **Name-Screen** file.
2. Run **/ds-lint** on one of their screens. Don't fix anything: it's their file.
3. Play the prototype. Check the motion against the standard: tokens and curve, the profile for the product, nothing animating balances, amounts or errors.
4. Leave at least **3 comments** in their file, each pinned to the layer it's about, saying what and why. At least one on structure or naming, one on motion.
5. Tell them you've reviewed it.

**Tip:**

> /ds-lint this frame (link to their screen). Report only, don't change anything.

### What to send
- The link to their flow, where your comments are.
- Screenshots of your comments and the lint result.
- Whose flow you reviewed, and one thing you'd copy from it.
