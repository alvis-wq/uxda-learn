---
slug: wf-6-handoff-ready
title: Make it handoff-ready
category: wireframing
type: figma
difficulty: 2
points: 20
estimated_minutes: 40
status: draft
tip: >-
  Read the AI's annotations as if you were the developer. Anything that says "always" or
  "never" without proof is probably an assumption, not a fact.
submission:
  screenshots:
    min: 1
    max: 3
    label: The finished section with annotations
  figma_url:
    required: true
    label: Link to the Commentary Section in Figma
  reflection:
    required: true
    min_words: 5
    prompt: Paste one AI annotation and your better version. Why is yours better?
rubric:
  - id: section
    criterion: The flow is organised into a Commentary Section with a review status
    points: 8
    levels:
      full: Screens grouped with /format, annotations added, and a review status set
      partial: Only some of it done
      none: Not done, or the link doesn't open
  - id: rewrite
    criterion: One AI annotation rewritten so it's clearer or more correct
    points: 8
    levels:
      full: The rewrite fixes a real problem (vague, wrong, or an assumption written as fact)
      partial: Only small wording changes
      none: No rewrite
  - id: why
    criterion: Explains why the rewrite is better
    points: 4
    levels:
      full: Clear reason a developer or client would understand
      partial: Vague reason
      none: Missing
grader_notes: |
  Habit: Claude Code at the END of the process — /format into a Commentary Section, then the
  handoff-commentary skill for annotations and review status (approved, updates required,
  waiting for approval, variant).
  Good rewrites: move an assumption ("users always have a linked account") to Assumptions/Open
  questions; replace vague logic ("validates input") with a real rule (e.g. minimum €1, max =
  account balance).
  If the link can't be opened: score from screenshots, confidence low, flag figma_inaccessible.
---
## Make it handoff-ready
**Time:** about 40 minutes

**The brief:** a banking app wants a savings goal screen. The user sees their goal, e.g. "Summer trip — €1,200", how much they've saved, and can add money.

This builds on [From Claude Design to Figma](/challenges/wf-4-claude-design-to-figma): you take that flow
and make it ready for a developer or the client.

### What to do
1. Take your 3-screen savings-goal flow in Figma.
2. In Claude Code, run **/format** to put it into a **Commentary Section**.
3. Ask Claude Code to add **handoff annotations** and set the **review status**.
4. Read the annotations. **Rewrite one** that's vague, wrong, or states a guess as a fact.

### What to send
- A **screenshot** of the finished section.
- The **link** to it in Figma.
- **A short note:** the AI's annotation, your version, and why yours is better.
