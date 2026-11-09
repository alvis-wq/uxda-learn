---
slug: bfl-5-prototype
title: Wire the prototype
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: mixed
difficulty: 2
points: 10
estimated_minutes: 25
waiting_minutes: 10
status: draft
submission:
  figma_url:
    required: true
    label: Link to the prototype (Present mode, anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 3
    label: The prototype connections between your screens
  reflection:
    required: true
    min_words: 10
    prompt: What did /ds-prototype wire by itself, and what did you have to decide?
rubric:
  - id: wired
    criterion: "Every screen is reachable, from the first to the last"
    points: 4
    levels:
      full: "A flow starting point, and clicking through reaches every screen and back"
      partial: "Some screens can't be reached, or no way back"
      none: "No connections"
  - id: motion
    criterion: "Component motion plays inside the prototype"
    points: 4
    levels:
      full: "Hovering or pressing components in the flow plays their motion from milestone 4"
      partial: "The flow works but the components don't animate (library update not accepted)"
      none: "No motion visible"
  - id: reflection
    criterion: "Says what was wired automatically and what they decided"
    points: 2
    levels:
      full: "Names at least one connection they had to decide or fix"
      partial: "Vague"
      none: "No reflection"
grader_notes: |
  Milestone 5 of 6 in "Bring your flow to life". A prototype link (figma.com/proto/… or a design link with a flow
  starting point) for Name-Screen. Play it: every screen reachable, a way back, and the components from milestone 4
  animate on hover (press too if they kept it). /ds-prototype asks about branches and hubs instead of guessing, so a
  good reflection names one of those decisions.
  Code Layers is an optional extra, not scored.
  Common mistakes: wiring connections on the library components instead of the instances in the flow, forgetting to
  accept the library update (no motion), a link that opens the design instead of the prototype.
---
Link your screens so the whole thing plays, with the motion you added inside it.

![The finished login flow playing: hover motion on the buttons, then screen to screen](/challenges/motion-flow-demo.webp)

### What to do
1. Run **/ds-prototype** on your flow in **Name-Screen**. Check its wiring list before approving; it asks where a screen could go two ways.
2. Open **Present** mode and click through from the first screen to the last, and back.
3. Hover and press your components: the motion from the last milestone should play.
4. Copy the prototype link (**Share prototype**), set to anyone at UXDA.

**Tip:**

> /ds-prototype Wire the flow in my Name-Screen file (link), first screen to last, with a way back.

**Optional extra:** try Figma's new **Code Layers** on one screen and see the motion play as real code. How it works: [Design together with code layers](https://www.figma.com/blog/design-together-with-code-layers/). It uses Figma AI credits, so one screen is enough.

### What to send
- The prototype link.
- A screenshot of the connections between your screens.
- What **/ds-prototype** wired by itself, and what you had to decide.
