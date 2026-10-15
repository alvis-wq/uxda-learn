---
slug: bwt-2-copy-template
title: Copy your template and add a design file
category: design-systems
audiences: [designer]
path: build-with-the-template
type: mixed
difficulty: 1
points: 10
estimated_minutes: 15
status: draft
submission:
  screenshots:
    min: 1
    max: 3
    label: A screenshot of your folder showing both files
  figma_url:
    required: true
    label: Link to Name-Screen (anyone at UXDA must be able to open it)
rubric:
  - id: folder
    criterion: "Both files are in their Sandbox folder"
    points: 3
    levels:
      full: "The screenshot shows their folder with both files in it"
      partial: "Only one of the files is in the folder"
      none: "No folder screenshot"
  - id: names
    criterion: "The files are named Name-DS-template and Name-Screen, with their own name"
    points: 3
    levels:
      full: "Both named exactly like Alvis-DS-template and Alvis-Screen, with their name"
      partial: "One is right, or a name is close (e.g. still \"(Copy)\" in it)"
      none: "Default names, e.g. \"Untitled\" or \"… (Copy)\""
  - id: branded
    criterion: "Name-DS-template is the branded copy"
    points: 2
    levels:
      full: "Its colours are the brand's from \"Bring a brand into the template\", not the placeholders"
      partial: "Can't tell which copy it is"
      none: "A fresh copy of the original template, with the placeholder colours"
  - id: library
    criterion: "Name-Screen uses the Name-DS-template library"
    points: 2
    levels:
      full: "In Name-Screen, their Name-DS-template library is turned on"
      partial: "A library is on, but not theirs (e.g. the original template)"
      none: "No library turned on, or the link doesn't open"
grader_notes: |
  Milestone 2 of 4 in "Build a screen with the template". The screenshot: their Sandbox folder with two files,
  <their name>-DS-template and <their name>-Screen. The link opens Name-Screen; its enabled libraries should include
  their Name-DS-template (published from the Assets panel). Name-DS-template must be a copy of their branded
  Name-DS-test-template (brand colours, not "Brand [PLACEHOLDER]"); the original template's file key is
  374PbreBmX1o0RkhwnJi1r. Common mistakes: copying the original template instead of the branded one, leaving
  "(Copy)" in the name, not publishing the library or not turning it on in Name-Screen. If the link can't be opened:
  confidence low, flag figma_inaccessible.
---
Put a copy of your branded template in your Sandbox folder, publish it as a library, and add a design file that uses it.

**Name** always means your own name, for example **Alvis-DS-template** and **Alvis-Screen**.

### What to do
1. In Figma, find your **Name-DS-test-template**: the branded copy from "Bring a brand into the template".
2. Duplicate it and move the copy into your Sandbox folder.
3. Rename the copy **Name-DS-template**.
4. Open **Name-DS-template** and publish it as a library: **Assets** panel → **Publish**.
5. In the same Sandbox folder, create a new blank design file and name it **Name-Screen**.
6. In **Name-Screen**, turn on your **Name-DS-template** library (**Assets** panel → **Libraries**).

Your folder will look like this, with your own file names:

![Example Sandbox folder in Figma with a copy of the design system template in it](/challenges/sandbox-step-4.png)

### What to send
- A screenshot of your folder showing both files.
- The link to **Name-Screen**.
