---
slug: bfl-3-motion-ready
title: Make one component motion-ready
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: mixed
difficulty: 3
points: 10
estimated_minutes: 40
waiting_minutes: 20
status: draft
submission:
  figma_url:
    required: true
    label: Link to the Before/After play frame in Name-DS-template (anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 3
    label: The /ds-motion-structure report (met, missing, broken)
  reflection:
    required: true
    min_words: 15
    prompt: What did the report find, did you apply the changes to the real component, and why or why not?
rubric:
  - id: report
    criterion: "A /ds-motion-structure report for one component from their flow"
    points: 3
    levels:
      full: "The report for a component the flow uses (e.g. Button), with met, missing and broken rules"
      partial: "A report, but for a component the flow doesn't use"
      none: "No report"
  - id: fixture
    criterion: "A Before/After play frame they can play in Present mode"
    points: 3
    levels:
      full: "The play frame exists in their Name-DS-template, Before and After side by side"
      partial: "A fixture without the play frame, or only screenshots"
      none: "No fixture"
  - id: decision
    criterion: "A reasoned apply/don't apply decision"
    points: 4
    levels:
      full: "Says whether they applied it to the real component and why, naming at least one rule (e.g. the press scale, the focus ring)"
      partial: "A decision without a reason"
      none: "No decision"
grader_notes: |
  Milestone 3 of 6 in "Bring your flow to life". In their Name-DS-template (the Sandbox copy, never the original
  template): /ds-motion-structure run on one component set the flow uses, a report by rule (met, missing, broken,
  check), and a "<Set> / motion fixture / play" frame on the "Motion fixtures" page with Before and After.
  A strong answer: names the rule that mattered (same layer names in every variant, an inner surface so a press can
  scale without moving neighbours, a focus ring outside the layout) and decides on applying it, e.g. "applied: the
  press no longer shifts the label" or "not applied: 40 instance overrides would be lost".
  "Nothing to fix, every rule met" with the report showing that is a full answer for the report and decision; the
  fixture can then be skipped (partial on fixture is fine). The skill is new: a reported skill error with what they
  tried is a good answer too.
---
Before a component can move, its layers have to allow it. **/ds-motion-structure** checks one component against the Motion Library's structure rules and builds a Before/After copy you can play.

### What to do
1. Pick one component your flow uses, for example **Button**, in your **Name-DS-template**.
2. Run **/ds-motion-structure** on it and read the report: what is **met**, **missing** or **broken**.
3. Let it build the **fixture**: a restructured copy with motion, on a separate "Motion fixtures" page.
4. Play the **play frame** in Present mode: Before is your component, After is the fixture.
5. Decide: apply the changes to the real component, or not. Instances stay linked either way; the skill tells you how many overrides a change could cost.

**Tip:**

> /ds-motion-structure (link to the Button component set in my Name-DS-template)

Look at the [Motion Library](https://www.figma.com/design/IgAFD2ItfGmi4tgyvv4rC1/Motion-Library-in-process?node-id=0-1) to see how each component should move. It's still in progress.

### What to send
- The link to the play frame.
- A screenshot of the report.
- What the report found, whether you applied it, and why.
