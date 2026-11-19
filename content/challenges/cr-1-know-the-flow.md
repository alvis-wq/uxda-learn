---
slug: cr-1-know-the-flow
title: Know the flow
category: design-systems
audiences: [designer]
path: deliver-a-component-request
type: quiz
feedback_mode: instant
difficulty: 1
points: 10
estimated_minutes: 10
status: draft
questions:
  - id: q1
    kind: order
    prompt: "Put the steps of one component request in order."
    items:
      - { id: draft, label: "Draft the component in a section of the build file" }
      - { id: request, label: "Run /cr-request: Claude writes the plan and you approve it" }
      - { id: build, label: "Claude builds the component and you check every mode" }
      - { id: deliver, label: "Run /cr-deliver: Claude checks everything and loads the plugin" }
      - { id: paste, label: "Paste into the client's file and run Token Deliver" }
      - { id: next, label: "Run /cr-next with the report to close the request" }
    explanation: "Draft, plan, build and check, prepare, deliver by hand, close."
    points: 2
  - id: q2
    kind: match
    prompt: "Who does each step?"
    categories:
      - { id: claude, label: "Claude Code" }
      - { id: you, label: "You, by hand in Figma" }
    items:
      - { id: plan, label: "Writes the plan from your draft", match: claude }
      - { id: bind, label: "Builds the component and links its tokens", match: claude }
      - { id: modes, label: "Checks that every mode looks right", match: you }
      - { id: paste, label: "Pastes the component into the client's file", match: you }
      - { id: run, label: "Runs Token Deliver and clicks Deliver", match: you }
    explanation: "Claude works only in the build file. Everything in the client's file is done by you."
    points: 2
  - id: q3
    kind: single
    prompt: "Which Figma file does Claude work in?"
    options:
      - { id: a, label: "The client's design system file" }
      - { id: b, label: "The client's Playground" }
      - { id: c, label: "The private UXDA build file" }
      - { id: d, label: "Whichever file the link points to" }
    answer: c
    explanation: "Client files are never opened by Claude. A link to one is refused before anything happens."
    points: 1
  - id: q4
    kind: single
    prompt: "You paste the component into the client's file and Figma asks whether to add variables or styles. What do you do?"
    options:
      - { id: a, label: "Accept, so the tokens come along" }
      - { id: b, label: "Choose not to, or let the prompt close by itself" }
      - { id: c, label: "Accept, then delete the extra collections" }
      - { id: d, label: "Cancel the paste and ask Claude to do it" }
    answer: b
    explanation: "Accepting copies half-linked build collections into the client's file. The plugin then blocks delivery until you undo the paste, paste again and decline."
    points: 1
  - id: q5
    kind: single
    prompt: "The client's file has a token with the same name as ours, but a different value. What does Token Deliver do?"
    options:
      - { id: a, label: "Replaces their value with ours" }
      - { id: b, label: "Renames their token and adds ours" }
      - { id: c, label: "Reports a conflict and leaves their token as it is" }
      - { id: d, label: "Deletes our token and uses the nearest of theirs" }
    answer: c
    explanation: "The client's tokens and styles are never overwritten, renamed or deleted. A conflict is reported and left for you to settle."
    points: 1
  - id: q6
    kind: single
    prompt: "The plugin's preview says BLOCKED. What has changed in the client's file?"
    options:
      - { id: a, label: "Nothing. Fix what it names and run the plugin again" }
      - { id: b, label: "The tokens were added, but not linked" }
      - { id: c, label: "The component was delivered without its tokens" }
      - { id: d, label: "The client's tokens were replaced" }
    answer: a
    explanation: "A blocked run changes nothing. The preview names what to fix."
    points: 1
  - id: q7
    kind: single
    prompt: "Your draft has the variants Theme=Light and Theme=Dark. What happens to them?"
    options:
      - { id: a, label: "They stay as two variants" }
      - { id: b, label: "They're built as two separate components" }
      - { id: c, label: "They become mode examples, not variants" }
      - { id: d, label: "Dark is dropped" }
    answer: c
    explanation: "Themes, platforms, brands and languages are modes, never variants. The Mode examples frame shows them."
    points: 1
  - id: q8
    kind: single
    prompt: "Your draft has a padding of 13px, which isn't on the client's spacing scale. What does Claude do?"
    options:
      - { id: a, label: "Rounds it to the nearest step without saying" }
      - { id: b, label: "Creates a new spacing token for it" }
      - { id: c, label: "Leaves 13px as it is, without a note" }
      - { id: d, label: "Flags it with the steps below and above, and you decide" }
    answer: d
    explanation: "Spacing, radius, text and effects reuse the client's system. Anything off the scale is flagged for your decision."
    points: 1
---
Eight questions on how a component request goes from draft to the client's file. Read this first.

### When it's used
A client owns their design system and asks us for a new component. We usually have view access only, so we build in a private UXDA file and deliver by hand. The **uxda-component-requests** plugin in Claude Code runs it.

### The three files
- **The build file**: a private UXDA Figma file with a copy (a "mirror") of the client's tokens. Claude works only here.
- **The client's file**: where the component ends up, for example their Playground. Claude never opens it.
- **Token Deliver**: a small Figma plugin made for that client. You run it in the client's file.

### One request, step by step
1. **Draft**: you draw the component in a section on the build file's "Component requests" page.
2. **/cr-request \<section link\>**: Claude matches every colour, size and text value to the client's tokens and writes a plan. You approve it.
3. **Build and check**: Claude builds the component and adds a "Mode examples" frame. You check every mode.
4. **/cr-deliver**: Claude checks everything and loads the plugin with this request.
5. **By hand in Figma**: you copy the component and "Mode examples", paste them into the client's file and run Token Deliver. Read the preview, click Deliver, copy the report.
6. **/cr-next \<report\>**: Claude closes the request and logs it.

### The rules the plugin holds
- Claude never opens a client file.
- Nothing delivered mentions Claude, Anthropic or AI.
- The client's tokens and styles are never overwritten, renamed or deleted. Same name with another value is a conflict: reported and left alone.
- New colours become the component's own tokens. Spacing, radius, text and effects reuse the client's system; anything off the scale is flagged for you to decide.
- Themes, platforms, brands and languages are modes, never variants.
- When Figma asks to add variables or styles on paste, choose not to. If it was accepted, the plugin says BLOCKED and changes nothing.
