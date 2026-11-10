---
slug: bfl-5-prototype
title: Wire the prototype and build it in Code Layers
category: design-systems
audiences: [designer]
path: bring-your-flow-to-life
type: mixed
difficulty: 3
points: 10
estimated_minutes: 45
waiting_minutes: 15
status: draft
submission:
  figma_url:
    required: true
    label: Link to the prototype (Present mode, anyone at UXDA must be able to open it)
  screenshots:
    min: 2
    max: 4
    label: The prototype connections, and your code layer playing next to the Figma screens
  reflection:
    required: true
    min_words: 20
    prompt: What did /ds-prototype wire by itself, and what did you decide? What did the code layer get right or wrong compared with your Figma prototype, and what did you prompt to fix it?
rubric:
  - id: wired
    criterion: "Every screen is reachable, from the first to the last"
    points: 3
    levels:
      full: "A flow starting point, and clicking through reaches every screen and back"
      partial: "Some screens can't be reached, or no way back"
      none: "No connections"
  - id: motion
    criterion: "Component motion plays inside the prototype"
    points: 2
    levels:
      full: "Hovering or pressing components in the flow plays their motion from milestone 4"
      partial: "The flow works but the components don't animate (library update not accepted)"
      none: "No motion visible"
  - id: code-layer
    criterion: "The flow is built as a code layer that plays"
    points: 3
    levels:
      full: "A code layer of the flow's screens, next to them in Name-Screen, that plays and clicks from screen to screen"
      partial: "A code layer of one screen only, or one that doesn't navigate"
      none: "No code layer"
  - id: reflection
    criterion: "Compares the code layer with the Figma prototype"
    points: 2
    levels:
      full: "Names one wiring decision, and at least one concrete difference in the code layer and the prompt used to fix it"
      partial: "Vague, or only one of the two"
      none: "No reflection"
grader_notes: |
  Milestone 5 of 6 in "Bring your flow to life". Two parts:
  1. A prototype link (figma.com/proto/… or a design link with a flow starting point) for Name-Screen. Play it: every
     screen reachable, a way back, and the components from milestone 4 animate on hover (press too if they kept it).
     /ds-prototype asks about branches and hubs instead of guessing, so a good reflection names one of those decisions.
  2. A code layer in Name-Screen, built from the flow's screens (select the frames → Code / B → Build selection),
     placed next to the screens. In the screenshot it is playing (Play in the layer's top-right corner). It should
     navigate between the screens; the hover motion may or may not survive the conversion, and saying what changed
     and how they prompted the Figma agent to fix it is the point of the reflection.
  Common mistakes: wiring connections on the library components instead of the instances in the flow, forgetting to
  accept the library update (no motion), a link that opens the design instead of the prototype, a code layer built
  in the library file, a code layer of one screen only.
  Code Layers is in open beta and uses Figma AI credits: a designer who ran out of credits and says so, with what
  they tried, gets partial on code-layer rather than none.
---
Link your screens so the whole thing plays, with your motion inside it. Then build the same flow as a **code layer**: Figma's new feature that turns your design into real, working code on the canvas.

![The finished login flow playing: hover motion on the buttons, then screen to screen](/challenges/motion-flow-demo.webp)

### Part 1: the Figma prototype
1. Run **/ds-prototype** on your flow in **Name-Screen**. Check its wiring list before approving; it asks where a screen could go two ways.
2. Open **Present** mode and click through from the first screen to the last, and back.
3. Hover and press your components: the motion from the last milestone should play.
4. Copy the prototype link (**Share prototype**), set to anyone at UXDA.

**Tip:**

> /ds-prototype Wire the flow in my Name-Screen file (link), first screen to last, with a way back.

### Part 2: the code layer
1. In **Name-Screen**, select all the screens of your flow.
2. Select **Code** in the toolbar (or press **B**), then **Build selection** in the right sidebar. Put the code layer next to your screens.
3. Press **Play** in the code layer's top-right corner and click through it.
4. Compare it with your Figma prototype: does it go from screen to screen? Does the hover motion play, with the same timing? Ask the Figma agent to fix what's different, for example:

> Make the buttons navigate between the screens like in my prototype, and keep the hover animation: 100 ms, ease-out.

How it works: [Design together with code layers](https://www.figma.com/blog/design-together-with-code-layers/) and [Figma's guide](https://help.figma.com/hc/en-us/articles/44193259600535-Code-layers-in-Figma-Design). Code layers use Figma AI credits, so build it once and fix it with a few short prompts.

### What to send
- The prototype link.
- Screenshots: the connections between your screens, and your code layer playing next to them.
- What **/ds-prototype** wired by itself and what you decided, and what the code layer got right or wrong and how you fixed it.
