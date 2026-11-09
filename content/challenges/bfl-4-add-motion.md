---
slug: bfl-4-add-motion
title: Add motion
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
    label: Link to one component with motion in Name-DS-template (anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 3
    label: The prototype panel of one variant, showing its animation (trigger, Smart animate, duration, curve)
  reflection:
    required: true
    min_words: 20
    prompt: Which profile and personality did you pick and why? What did Claude propose that you changed or rejected?
rubric:
  - id: motion
    criterion: "Motion on at least two components the flow uses"
    points: 3
    levels:
      full: "Two or more components animate between their states (e.g. Button hover, Input focus)"
      partial: "Only one component"
      none: "No motion"
  - id: standard
    criterion: "Follows the motion standard"
    points: 3
    levels:
      full: "Smart animate, a duration from the tokens, the library's curve; no motion on balances, amounts or errors"
      partial: "Animates, but with a hand-picked duration or curve, or moves a number"
      none: "Dissolve or instant everywhere, or animated data"
  - id: published
    criterion: "The library is published and Name-Screen uses the update"
    points: 1
    levels:
      full: "Instances in Name-Screen play the motion"
      partial: "Motion only in the library file"
      none: "Not published"
  - id: reflection
    criterion: "Explains the profile, the personality and their own changes"
    points: 3
    levels:
      full: "Names the profile and personality with a reason tied to the product, and at least one change to Claude's proposal"
      partial: "Names them without a reason, or no change mentioned"
      none: "No reflection"
grader_notes: |
  Milestone 4 of 6 in "Bring your flow to life". /ds-motion on at least two component sets the flow uses, in their
  Name-DS-template. In the prototype panel: Smart animate, a duration token (e.g. 100 or 200 ms in their file), the
  Motion Library curve (custom bezier 0.05, 0, 0.3, 1 on most), and a "Motion:" line in the component description.
  Profile is Smooth, Snappy or Minimal; personality Base, Expressive or Playful. A strong reason ties them to the
  product (a bank → Smooth + Base; a game → Snappy + Playful). Balances, amounts, errors and security steps must not
  animate.
  Known issue (Nov 2026): press reactions can stop a button's click from navigating in the prototype. Keeping hover
  only and saying so is a full answer.
---
Now make your components move, the way the [Motion Library](https://www.figma.com/design/IgAFD2ItfGmi4tgyvv4rC1/Motion-Library-in-process?node-id=0-1) does it.

### The motion standard, in short
- **One curve** and **duration tokens**, never a number you picked by eye.
- **Smart animate** between a component's own states: hover, press, focus, open.
- **Never animate data:** balances, amounts, errors and security steps stay still.
- **Profile** (Smooth, Snappy or Minimal) and **personality** (Base, Expressive or Playful) depend on the product.

### What to do
1. Run **/ds-motion** on at least two components your flow uses, for example **Button** and **Input**.
2. Answer its questions: profile and personality. Pick for the product your screens are for.
3. Read its proposal before approving. Change what doesn't fit.
4. **Publish** your **Name-DS-template** library, then accept the update in **Name-Screen**.

![Every Button variant in one component set: types, sizes and states](/challenges/motion-button-states.png)

**Tip:**

> /ds-motion (link to the Button component set) (link to the Input component set)

**Known issue:** if your buttons stop navigating in the prototype after adding **press** motion, keep **hover** only and say so. It's being fixed.

### What to send
- The link to one component with motion.
- A screenshot of its prototype panel.
- Your profile and personality and why, and what you changed in Claude's proposal.
