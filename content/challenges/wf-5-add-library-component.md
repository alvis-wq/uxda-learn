---
slug: wf-5-add-library-component
title: Add a component to the library
category: wireframing
type: figma
difficulty: 2
points: 20
estimated_minutes: 35
status: draft
tip: >-
  Pick something simple and common — like a progress bar, a chip or a small info card. A clear,
  cropped screenshot gives a much better result than a whole screen.
submission:
  screenshots:
    min: 2
    max: 4
    label: Your reference screenshot, and the new component Claude Code made
  figma_url:
    required: true
    label: Link to the new component in the library file
  reflection:
    required: true
    min_words: 40
    prompt: How close was the result to your reference? What did you have to correct?
rubric:
  - id: component
    criterion: A new wireframe component made from a screenshot with /add-component
    points: 10
    levels:
      full: The component matches the reference's structure, in the greyscale wireframe style, staged for review
      partial: Created, but it's far from the reference or not in wireframe style
      none: No component
  - id: reference
    criterion: A clear, useful reference
    points: 4
    levels:
      full: A cropped screenshot of one component, from a real app or design
      partial: A whole screen, or hard to tell which part is meant
      none: No reference screenshot
  - id: critique
    criterion: Compares the result with the reference and names what they corrected
    points: 6
    levels:
      full: Specific differences and what they fixed (or why they left it)
      partial: General comment only
      none: Missing
grader_notes: |
  Uses the uxda-wireframes /add-component command: the reference goes into the library file's
  "component requests" section, and the new component is staged for maintainer (Alvis) review —
  it's not live in the library until approved. That's expected; don't mark it down.
  If the link can't be opened: score from screenshots, confidence low, flag figma_inaccessible.
---
## Add a component to the library
**Time:** about 35 minutes

Our wireframe library doesn't have everything. You can add new components yourself with
**Claude Code** — from just a screenshot.

### What to do
1. Find a component you think is missing from our library (for example a savings progress bar
   from a real banking app). Take a **cropped screenshot** of just that component.
2. Put the screenshot in the **"component requests"** section of the wireframe library file.
3. In Claude Code, run **/add-component**.
4. Check the result. Correct what's wrong.

The new component waits for review before it goes live in the library. That's normal.

### What to send
- Your **reference screenshot** and a screenshot of the **new component**.
- The **link** to the new component.
- **3–4 sentences:** how close it got, and what you corrected.
