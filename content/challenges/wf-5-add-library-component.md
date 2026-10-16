---
slug: wf-5-add-library-component
title: Add a component to the library
category: wireframing
type: figma
difficulty: 2
points: 20
estimated_minutes: 35
status: draft
image: wf-5-add-library-component.png
tip: >-
  Pick something simple and common — like a progress bar, a chip or a small info card. A clear,
  cropped screenshot gives a much better result than a whole screen.
submission:
  screenshots:
    min: 0
    max: 4
    label: Optional. Your reference screenshot, and the new component Claude Code made
  figma_url:
    required: true
    label: Link to the new component in the library file (the reference screenshot in "component requests" is in the same file)
  reflection:
    required: false
    min_words: 5
    prompt: How close was the result to your reference? What did you have to correct?
rubric:
  - id: component
    criterion: A new wireframe component made from a screenshot with /add-component
    points: 16
    levels:
      full: The component, as seen in the Figma link, matches the reference's structure, in the greyscale wireframe style, staged for review
      partial: Created, but it's far from the reference or not in wireframe style
      none: No component
  - id: reference
    criterion: A clear, useful reference in the "component requests" section
    points: 4
    levels:
      full: A cropped screenshot of one component, from a real app or design, in "component requests" in the Figma file
      partial: A whole screen, or hard to tell which part is meant
      none: No reference in the file
grader_notes: |
  Uses the uxda-wireframes /add-component command: the reference goes into the library file's
  "component requests" section, and the new component is staged for maintainer (Alvis) review —
  it's not live in the library until approved. That's expected; don't mark it down.
  The Figma link alone can get full marks: the reference is in the file's "component requests"
  section, and the new component is in the file. Screenshots and the written note are optional
  extras. Don't mark anyone down for leaving them out. If screenshots are sent, use them to help
  judge the component.
  If the link can't be opened: score from the screenshots if there are any, otherwise give a low
  score with confidence low, flag figma_inaccessible.
---
## Add a component to the library
**The brief:** a banking app wants a savings goal screen. The user sees their goal, e.g. "Summer trip — €1,200", how much they've saved, and can add money.

This builds on [Build a screen with /new-screen](/challenges/wf-2-new-screen), where you used library
components. Here you add one the library is missing.

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
- The **link** to the new component in the library file. This is all you need: your reference
  screenshot is in the same file, in "component requests".
- Optional: your **reference screenshot** and a **screenshot of the new component**.
