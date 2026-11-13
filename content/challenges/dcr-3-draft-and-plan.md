---
slug: dcr-3-draft-and-plan
title: Draft and plan
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 40
waiting_minutes: 10
status: draft
submission:
  screenshots:
    min: 1
    max: 4
    label: plan.md with all five traps, and your approval of the plan
  reflection:
    required: true
    min_words: 30
    prompt: For the colour and the padding, which option did you pick (use the nearest, keep the raw value, or ask for a new token) and why? For the other three traps, what did the plan say to do?
rubric:
  - id: draft
    criterion: "A small card component drafted in a section on the Component requests page of the build file"
    points: 2
    levels:
      full: "A card component inside a section in Name-CR-build"
      partial: "A frame instead of a component, or no section"
      none: "No draft, or drafted in another file"
  - id: traps
    criterion: "plan.md lists all five traps"
    points: 5
    levels:
      full: "The off-system colour, the off-scale padding, the duplicate layer names, the \"AI tip\" layer and Theme=Light/Dark as modes all appear"
      partial: "Three or four of the five appear"
      none: "Two or fewer, or no plan"
  - id: reflection
    criterion: "Explains each decision"
    points: 3
    levels:
      full: "Names the option picked for the colour and the padding with a reason, and what the plan did with the other three"
      partial: "Only some traps covered, or no reasons"
      none: "No reflection, or unrelated"
grader_notes: |
  Milestone 3 of 6 in "Deliver a component request". The plan's sections: structure and variants (Theme=Light/Dark
  called out as modes: they become mode examples, not variants), layer cleanup (the duplicate names with a unique name
  each; "AI tip" as a forbidden term with a rename), new colour tokens, existing tokens to bind, flags needing a
  decision (the orange with its nearest colour and ΔE; the 13px padding with the steps below and above), nested
  instances, mode examples. The approval can be their "yes" reply in Claude Code or the plan's status moving on.
  A strong reflection: a reason per choice, e.g. "nearest spacing token, 13px was a typo" or "kept the orange raw on
  purpose, recorded". The other three are fixes, not choices: renamed, renamed without "AI", made into modes.
  Common mistakes: a colour too close to a system colour, so it wasn't flagged (partial on traps); "ai tip" in lower
  case (only "AI" in capitals is a hit); the request run on a link to the playground or the tokens file instead of
  the section in the build file; drafting outside a section.
---
Draft a small component with five planted mistakes, and see the plan catch every one.

### What to do
1. Open **Name-CR-build** and go to the **Component requests** page.
2. Add a section and draw a small **card component** in it, from plain layers (no instances of other components). Plant five traps:
   - **An off-system colour** that looks clearly different from the template's colours, for example bright orange **#FF6A00**. A colour that's only slightly off is matched quietly, so it must look clearly different.
   - **A padding that's off the spacing scale**, for example **13px**.
   - **Two sibling layers with the same name.**
   - **A layer named "AI tip".**
   - **A variant property Theme** with the values **Light** and **Dark**.
3. Copy the section's link (right-click the section → **Copy link**).
4. Start a new Claude Code chat in the client's workspace folder and run **/cr-request \<section link\>**.
5. It reads every colour, size and text value, matches it to the client's system and writes **plan.md**. Then it stops for your OK.
6. Read the plan. For the colour and the padding, choose: **use the nearest**, **keep the raw value** (on purpose, recorded), or **ask for a new token**. Then approve the plan.

After your OK it goes on to build. Send this milestone while it works, then carry on with the next one in the same chat.

### What to send
- A screenshot of **plan.md** showing all five traps (several screenshots if it's long).
- A screenshot of your approval.
- For the colour and the padding, which option you picked and why. For the other three, what the plan said to do.
