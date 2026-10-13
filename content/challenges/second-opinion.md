---
slug: second-opinion
title: Get a second opinion
category: ai-workflow
audiences: [strategist, designer]
type: quiz
difficulty: 1
points: 10
estimated_minutes: 5
status: draft
questions:
  - id: q1
    kind: single
    prompt: |
      You run /check in Claude Code and get this message:

      "/check found 14 detached instances on the 'Onboarding v3' page. They were copied from an older library version, so they no longer match the current library. Re-linking them will reset changes on 9 of them, including edited text in the KYC steps.

      I can re-link all 14 now, or skip them and continue with /format. Re-linking can't be undone from the plugin. You would need Figma's version history to get the changes back."

      You're not sure what this means. What's the best next step?
    options:
      - { id: a, label: "Tell Claude Code to re-link everything — it suggested it first" }
      - { id: b, label: "Skip it — warnings usually don't matter" }
      - { id: c, label: "Paste the message into a normal Claude chat (Opus 5.5, medium or high effort) and ask what each option means and what you'd lose" }
      - { id: d, label: "Delete the page and start again" }
    answer: c
    points: 2
  - id: q2
    kind: single
    prompt: You decide to re-link. The message said it can't be undone. What do you do first?
    options:
      - { id: a, label: "Nothing — Figma keeps everything anyway" }
      - { id: b, label: "Save a version in Figma's version history (or duplicate the page)" }
      - { id: c, label: "Ask a colleague to watch" }
      - { id: d, label: "Run /check again" }
    answer: b
    points: 2
  - id: q3
    kind: single
    prompt: Claude Code stops and asks for permission before changing a shared file. What do you do?
    options:
      - { id: a, label: "Click yes quickly — it's slowing you down" }
      - { id: b, label: "Read what it wants to change. Say yes only if you understand it and it's what you asked for" }
      - { id: c, label: "Always say no" }
      - { id: d, label: "Close Claude Code" }
    answer: b
    points: 2
  - id: q4
    kind: single
    prompt: Claude needs a password or API key to set something up. What do you do?
    options:
      - { id: a, label: "Paste it in the chat — the chat is private" }
      - { id: b, label: "Never paste it in the chat. Put it where the tool's settings say. If you already pasted one, replace it with a new one" }
      - { id: c, label: "Paste it and delete the message later" }
      - { id: d, label: "Paste only half of it" }
    answer: b
    points: 2
  - id: q5
    kind: single
    prompt: You're about to start a bigger task in Claude Code, like a 6-screen flow. What saves the most time?
    options:
      - { id: a, label: "Let it start building right away" }
      - { id: b, label: "Ask for a short plan first, fix what's wrong, then let it build" }
      - { id: c, label: "Write every step yourself in detail" }
      - { id: d, label: "Split it into 20 tiny prompts" }
    answer: b
    points: 2
---
## Get a second opinion
Sometimes Claude Code shows a warning that's hard to understand. You don't have to decide on your
own, and you shouldn't just pick the first option.

**Habit:** if you don't understand a warning, paste it into a normal Claude chat with
**Opus 5.5 (medium or high effort)** and ask what each option means and what could go wrong.

5 questions, about 5 minutes.
