---
slug: wf-4-claude-design-to-figma
title: From Claude Design to Figma
category: wireframing
type: figma
difficulty: 2
points: 20
estimated_minutes: 35
status: draft
tip: >-
  Ask Claude Design for the whole flow in one go, then fix it with follow-up messages. It's
  faster than starting over each time.
submission:
  screenshots:
    min: 1
    max: 3
    label: The flow in Claude Design
  figma_url:
    required: true
    label: Link to the flow in Figma (anyone at UXDA must be able to open it)
  reflection:
    required: true
    min_words: 5
    prompt: What did Claude Design get wrong, and what did you fix?
rubric:
  - id: flow
    criterion: A 3-screen savings-goal flow made in Claude Design
    points: 8
    levels:
      full: Goal overview, add money, and a confirmation screen, using the UXDA wireframe style
      partial: Fewer screens, or the flow doesn't make sense end to end
      none: No flow
  - id: in-figma
    criterion: The flow is in a Figma file and the link opens
    points: 6
    levels:
      full: All screens are in Figma, in order, and the link opens
      partial: Some screens missing, or extra access needed
      none: Not in Figma, or the link doesn't open
  - id: critique
    criterion: Names something the AI got wrong and what they changed
    points: 6
    levels:
      full: A specific mistake (missing state, wrong step, unclear text) and the fix
      partial: "\"Needed some fixes\" without details"
      none: Says it was all fine, or missing
grader_notes: |
  Habit: Claude Design for quick multi-screen exploration, then bring it into Figma.
  Expected screens: goal overview → add money (amount, source account) → success/confirmation.
  A strong answer notices a missing state (e.g. not enough money in the account) or confusing copy.
  If the link can't be opened: score from screenshots, confidence low, flag figma_inaccessible.
---
## From Claude Design to Figma
**Time:** about 35 minutes

**The brief:** a banking app wants a savings goal screen. The user sees their goal, e.g. "Summer trip — €1,200", how much they've saved, and can add money.

This builds on [Build a screen with /new-screen](/challenges/wf-2-new-screen): there you made one screen,
now you make a short flow. In **Claude Design**, using the **UXDA wireframe design system**, make 3
screens for the savings goal:

1. **Goal overview:** the goal, how much is saved, an "Add money" button.
2. **Add money:** choose the amount and the account to take it from.
3. **Done:** confirmation that the money was added.

### What to do
1. Create the flow in Claude Design.
2. Check it. Fix anything that's wrong or missing with follow-up messages.
3. Put the screens into a Figma file, in order.

### What to send
- **Screenshots** of the flow in Claude Design.
- The **link** to the flow in Figma.
- **A short note:** what Claude Design got wrong or missed, and what you changed.
