---
slug: wf-3-check-and-fix
title: Check it, fix it
category: wireframing
type: figma
difficulty: 1
points: 3
estimated_minutes: 15
status: draft
image: wf-3-check-and-fix.png
tip: >-
  Don't just trust the /check list. For each finding, look at the screen yourself and decide if
  it's really a problem.
submission:
  screenshots:
    min: 1
    max: 2
    label: The /check result
  figma_url:
    required: true
    label: Link to the screen after your fixes
  reflection:
    required: true
    min_words: 5
    prompt: What did you fix? Was anything /check flagged not a real problem?
rubric:
  - id: fixes
    criterion: Two /check findings fixed on the screen
    points: 2
    levels:
      full: Two findings from the screenshot are visibly fixed in the linked screen
      partial: One fixed, or fixes can't be matched to the findings
      none: Nothing fixed, or no /check screenshot
  - id: judgment
    criterion: Thinks about whether each finding is real
    points: 1
    levels:
      full: Says which findings matter and questions at least one, or explains why all are valid
      partial: Just lists the fixes
      none: Missing
grader_notes: |
  Habit: run /check after building, and use your own judgment on its output.
  Any screen is fine (ideally the one from "Build a screen with /new-screen").
  If the link can't be opened: score from the screenshot, confidence low, flag figma_inaccessible.
---
## Check it, fix it
**The brief:** a banking app wants a savings goal screen. The user sees their goal, e.g. "Summer trip — €1,200", how much they've saved, and can add money.

This builds on [Build a screen with /new-screen](/challenges/wf-2-new-screen): check the screen you made there.

Every screen should be checked before anyone else sees it. Our plugin has **/check** for that.

### What to do
1. Take your savings-goal screen (or any screen you built recently).
2. In Claude Code, run **/check**.
3. Fix **2** things it found.

### What to send
- A **screenshot** of the /check result.
- The **link** to the screen after your fixes.
- **A short note:** what you fixed, and if anything it flagged isn't really a problem.
