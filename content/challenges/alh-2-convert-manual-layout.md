---
slug: alh-2-convert-manual-layout
title: Convert a manual layout
category: tool-proficiency
audiences: [strategist]
path: auto-layout-homework
type: figma
difficulty: 2
points: 20
status: draft
submission:
  figma_url:
    required: true
    label: Link to your result in Figma (anyone at UXDA must be able to open it)
rubric:
  - id: structure
    criterion: "Structure: built with (nested) Auto Layout as the task asks"
    points: 4
    levels:
      full: "No hand-placed elements are left: the screen is one Auto Layout frame with nested frames for each group (header, rows, buttons)."
      partial: "Auto Layout is used, but some parts are still placed by hand or grouped instead of framed"
      none: "No Auto Layout, or the task isn't done"
  - id: sizing
    criterion: "Sizing: Fill, Hug and Fixed are set where they belong"
    points: 4
    levels:
      full: "Containers fill or hug as they should; only things that must keep a size are Fixed"
      partial: "Mostly right, with one or two wrong settings (e.g. text Fixed instead of Fill)"
      none: "Sizing left on defaults or wrong throughout"
  - id: resilience
    criterion: "Resilience: survives a text change and a 360 px resize"
    points: 4
    levels:
      full: "Longer text and a 360 px width keep the layout intact: nothing overlaps, clips or jumps"
      partial: "Holds up to one of the two, or breaks in one place"
      none: "Breaks on a text change or on resize"
  - id: values
    criterion: "Exact values: padding, gaps and sizes match the task"
    points: 4
    levels:
      full: "Padding, gaps and sizes are the exact numbers given in the task"
      partial: "Close, with a few values off"
      none: "Values guessed or not set"
  - id: names
    criterion: "Layer names: frames and layers are named"
    points: 4
    levels:
      full: "Every frame and the main layers have clear names (no \"Frame 12\")"
      partial: "Some layers named, others left as defaults"
      none: "Default names everywhere"
grader_notes: |
  Milestone 2 of 7 in the Auto Layout homework. Task: Rebuild a hand-placed screen with nested Auto Layout.
  Look only at the frames inside PLACE FINAL RESULT HERE. Each should be 360 px wide with a short
  written answer under it. Test it: change a text to something longer and resize the frame to 360 px.
  Common mistakes: elements nudged into place by dragging, groups used instead of frames, text set to
  Fixed width, default layer names. If the link can't be opened: confidence low, flag figma_inaccessible.
---
Rebuild a hand-placed screen with nested Auto Layout.

[Open the task in Figma](https://www.figma.com/design/LKdwVhWDOOCCCPxdbepcMi/Auto-layout-homework?node-id=0-1)
