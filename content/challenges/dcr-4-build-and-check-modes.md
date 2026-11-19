---
slug: dcr-4-build-and-check-modes
title: Build and check every mode
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 35
waiting_minutes: 20
status: draft
submission:
  screenshots:
    min: 2
    max: 3
    label: The Mode examples frame with every instance visible, and the built component selected with its properties showing
rubric:
  - id: mode-examples
    criterion: "A Mode examples frame next to the built component"
    points: 4
    levels:
      full: "The frame shows instances of the component, each labelled with its modes"
      partial: "The component is built, but the frame is missing or cut off"
      none: "No Mode examples frame"
  - id: every-mode
    criterion: "Every mode of every axis appears at least once"
    points: 4
    levels:
      full: "Light and Dark, Desktop and Mobile all appear on some instance"
      partial: "Some modes missing"
      none: "Only one mode shown"
  - id: no-theme-variant
    criterion: "Theme is a mode, not a variant"
    points: 2
    levels:
      full: "The component is selected and the right panel shows no Theme property"
      partial: "The right panel isn't shown, or it's unclear"
      none: "Theme is still a variant property"
grader_notes: |
  Milestone 4 of 6 in "Deliver a component request". After the plan was approved, /cr-request builds the component in
  the section, adds "Mode examples" (every theme and platform mode combination at least once, e.g. Light · Desktop,
  Dark · Mobile) and stops for the designer to check. They reply "checked" (or say what looks wrong, and it's fixed).
  Screenshot 1 should show the Mode examples frame with its labelled instances; Dark instances should look dark.
  Screenshot 2: the built component selected, with the right panel showing its properties (no Theme property).
  Common mistakes: replying "checked" without opening the frame (a Dark instance that still looks light), checking
  only the instances and not switching the page's modes, Theme kept as a variant.
---
Let Claude build the component, then check it in every mode before you say it's right.

### What to do
1. In the same chat as the last milestone, let **/cr-request** build. It builds the component in your section, adds a **Mode examples** frame (every theme and platform) and stops for you to check.
2. In **Name-CR-build**, open the request's section and the **Mode examples** frame.
3. For each instance, check that the colours, spacing and text look right for the modes named on it.
4. Switch the page's modes as well: open the right panel with nothing selected, then the variable modes section. Check that the component follows.
5. Select the built component and look at its properties in the right panel: **Theme** is gone. Take a screenshot.
6. Reply **checked**, or describe what looks wrong and let it fix it.

Picked the chat up later? Start a new chat in the client's workspace folder and run **/cr-request \<section link\>** again: it carries on where it stopped.

### What to send
- A screenshot of the **Mode examples** frame, with every instance visible.
- A screenshot of the built component selected, with its properties showing in the right panel.
