---
slug: when-claude-says-no
title: "\"I can't\" and \"Done!\""
category: ai-workflow
type: quiz
difficulty: 1
points: 10
estimated_minutes: 4
status: draft
image: when-claude-says-no.png
questions:
  - id: q1
    kind: single
    prompt: You ask Claude to read a document in our Google Drive. It says "I don't have access to your Google Drive." What do you do first?
    options:
      - { id: a, label: "Copy the whole document into the chat by hand" }
      - { id: b, label: "Check the Google Drive connector is turned on in this chat, then ask again" }
      - { id: c, label: "Use a different AI tool" }
      - { id: d, label: "Send the same message again" }
    answer: b
    points: 2
  - id: q2
    kind: single
    prompt: Claude says "I can't do that." You've seen it do similar things before. What do you say?
    options:
      - { id: a, label: "Nothing — it knows its limits" }
      - { id: b, label: "\"Are you sure? What exactly is stopping you? Is there another way?\"" }
      - { id: c, label: "Do the whole thing yourself" }
      - { id: d, label: "Restart your computer" }
    answer: b
    points: 2
  - id: q3
    kind: single
    prompt: Claude says "Done! Everything works." What's a good question to ask?
    options:
      - { id: a, label: "None — it said everything works" }
      - { id: b, label: "\"What exactly did you check, and did you skip anything?\"" }
      - { id: c, label: "\"Are you happy with it?\"" }
      - { id: d, label: "\"Can you make it better?\"" }
    answer: b
    points: 2
  - id: q4
    kind: single
    prompt: You disagree with Claude. It says "You're right!" and changes everything. What does that mean?
    options:
      - { id: a, label: "The new version is correct" }
      - { id: b, label: "Not much — check that the new version really fixes your point and didn't break something else" }
      - { id: c, label: "The first version was useless" }
      - { id: d, label: "You should never disagree with Claude" }
    answer: b
    points: 2
  - id: q5
    kind: single
    prompt: Claude tells you a company rule, like "All client files go in the Projects folder." You're not sure it's true. What do you do?
    options:
      - { id: a, label: "Trust it — it sounds right" }
      - { id: b, label: "Ask where it found this, then open that document and check" }
      - { id: c, label: "Ask \"Are you sure?\" and accept whatever it says" }
      - { id: d, label: "Ignore it" }
    answer: b
    points: 2
---
## "I can't" and "Done!"
Claude is sometimes wrong when it says it *can't* do something. And sometimes it says *done* too
early. In both cases, one more question from you helps.

5 questions, about 4 minutes.
