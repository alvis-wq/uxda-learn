---
slug: dcr-6-final-boss
title: "Final boss: three guardrails"
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: screenshot
difficulty: 2
points: 10
estimated_minutes: 15
status: draft
submission:
  screenshots:
    min: 3
    max: 4
    label: "One screenshot each: NOTHING TO CHANGE, the refused playground link, and the pointer to --update"
  reflection:
    required: true
    min_words: 30
    prompt: Which rule does each of the three protect, and what could go wrong for a real client without it?
rubric:
  - id: nothing-to-change
    criterion: "Running the plugin again on the delivered layers says NOTHING TO CHANGE"
    points: 2
    levels:
      full: "The plugin's result reads NOTHING TO CHANGE"
      partial: "A plugin result, but not this one"
      none: "Missing"
  - id: refused
    criterion: "/cr-request refuses the playground link"
    points: 2
    levels:
      full: "Claude says it's a client file and the plugin never opens it"
      partial: "Some other stop, e.g. it asks what the file is"
      none: "Missing, or Claude opened the file"
  - id: update
    criterion: "/cr-request on the delivered section points to --update"
    points: 2
    levels:
      full: "Claude says the section was delivered and to run /cr-request --update <component>"
      partial: "Another message about the section"
      none: "Missing"
  - id: reflection
    criterion: "Names the rule each one protects"
    points: 4
    levels:
      full: "All three matched: running twice is safe and nothing is overwritten; client files are never opened; a delivered component changes only through an update"
      partial: "One or two matched, or no consequences"
      none: "No reflection, or unrelated"
grader_notes: |
  Milestone 6 of 6 in "Deliver a component request". (a) Select the delivered layers in Name-CR-playground and run
  Token Deliver again: "NOTHING TO CHANGE" (running twice is safe; the client's tokens are never overwritten).
  (b) /cr-request with the playground link: "That file is a client file. This plugin never opens it." (client files
  are off limits). (c) /cr-request with the same section link as before: "That section was delivered as <folder>. To
  change the component, run /cr-request --update <component>." (a closed request is never rebuilt over; an update has
  its own rules and an "Apply updates" tick).
  Common mistakes: (c) run before the request was closed (it resumes the request instead: milestone 5 not finished),
  (b) with a link to the build file (it's allowed there), (a) with nothing selected in the playground.
---
Three quick tests: try to break the rules and watch the plugin hold.

### What to do
1. **Run it twice.** In the **Figma desktop app**, select the delivered layers in **Name-CR-playground** and run **Plugins → Development → Token Deliver – \<your client\>** again. It says **NOTHING TO CHANGE**.
2. **Knock on the client's door.** Start a new Claude Code chat in the client's workspace folder and run **/cr-request \<link to Name-CR-playground\>**. It refuses: the playground is on the client's off-limits list.
3. **Rebuild a delivered component.** Run **/cr-request \<the section link from milestone 3\>** again. It says the section was delivered, and points you to **/cr-request --update \<component\>**. Don't run the update.

### What to send
- One screenshot for each of the three.
- Which rule each one protects, and what could go wrong for a real client without it.
