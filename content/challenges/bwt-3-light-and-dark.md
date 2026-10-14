---
slug: bwt-3-light-and-dark
title: Build a screen in light and dark
category: design-systems
audiences: [designer]
path: build-with-the-template
type: mixed
difficulty: 2
points: 20
status: draft
submission:
  figma_url:
    required: true
    label: Link to Name-Screen (anyone at UXDA must be able to open it)
  screenshots:
    min: 1
    max: 3
    label: A screenshot of both frames side by side
  reflection:
    required: true
    min_words: 3
    prompt: Anything that didn't switch correctly?
rubric:
  - id: screen
    criterion: "One simple mobile screen"
    points: 4
    levels:
      full: "A complete mobile screen, e.g. a login or an account overview"
      partial: "Unfinished, or not a mobile screen"
      none: "No screen"
  - id: components
    criterion: "Only components from their Name-DS-template library"
    points: 6
    levels:
      full: "Every part is an instance from their Name-DS-template library"
      partial: "Mostly, but some parts are detached, drawn by hand or from another library"
      none: "Drawn by hand, or from another library"
  - id: dark
    criterion: "The copy is in Dark mode and looks right, with no manual colour changes"
    points: 7
    levels:
      full: "The copy is switched to Dark mode (Appearance), and every colour changed with it; no colours set by hand"
      partial: "Dark mode is set, but some parts didn't switch, or were recoloured by hand"
      none: "No dark copy, or the dark look was made by changing colours by hand"
  - id: note
    criterion: "A short note on what didn't switch"
    points: 3
    levels:
      full: "Says what didn't switch correctly, or that everything did"
      partial: "Vague"
      none: "No note"
grader_notes: |
  Milestone 3 of 4 in "Build a screen with the template". In Name-Screen: two frames of the same simple mobile screen,
  one in light and one switched to Dark mode via Appearance (the frame's variable mode), both built only from
  instances of their Name-DS-template library. Both should look right: text readable, no light-mode colours left in
  the dark one, and no colours overridden by hand (fills should be the library's variables, not raw hex).
  The note can be short; "everything switched" is a fine answer if it's true.
  Common mistakes: detached or hand-drawn parts, components from another library, recolouring the dark copy by hand
  instead of switching the mode. If the link can't be opened: confidence low, flag figma_inaccessible.
---
Build one simple screen from your library, then make a dark copy of it.

**Name** always means your own name, for example **Alvis-Screen**.

### What to do
1. In **Name-Screen**, build one simple mobile screen, for example a login or an account overview.
2. Use only components from your **Name-DS-template** library.
3. Duplicate the frame.
4. Switch the copy to Dark mode: select the frame → **Appearance** → change the mode.
5. Check both versions. They must look right with no manual colour changes.

### What to send
- The link to **Name-Screen**.
- A screenshot of both frames side by side.
- A short note: anything that didn't switch correctly?
