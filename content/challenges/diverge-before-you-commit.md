---
slug: diverge-before-you-commit
title: Diverge before you commit
category: wireframing
type: screenshot
difficulty: 1
points: 10
estimated_minutes: 45
status: published
submission:
  screenshots:
    min: 3
    max: 4
    label: One screenshot per concept (3 concepts), plus optionally your chosen one refined
  reflection:
    required: true
    min_words: 50
    prompt: >-
      Which concept did you pick? Defend it in 3 sentences. Then: what did the AI get wrong
      or keep repeating across concepts, and what did you have to push it on to get real variety?
rubric:
  - id: structural-diversity
    criterion: The three concepts are structurally different, not copy or order changes
    points: 4
    levels:
      full: Three genuinely different structures (e.g. list vs. card stack vs. step-by-step), each viable
      partial: Two are distinct, or differences are mostly visual/ordering
      none: Variations of one layout
  - id: defended-choice
    criterion: The chosen concept is defended with reasons tied to the user and the task
    points: 3
    levels:
      full: Clear choice with reasons about the user's task, constraints or risk — not taste
      partial: Choice made but reasons are vague ("cleaner", "looks better")
      none: No choice or no reasons
  - id: ai-critique
    criterion: Notices where the AI defaulted or repeated itself and how they pushed past it
    points: 3
    levels:
      full: Names a specific AI default or repetition and the prompt/change that broke it
      partial: Mentions AI limitations in general terms
      none: Not addressed
grader_notes: |
  Habit being trained: cheap breadth first. The tool must be Claude Design or Figma Make
  only — Claude Code use here is off-brief (flag off_brief).
  "Structurally different" = different information architecture or interaction model,
  e.g. a single scrolling page vs. a wizard vs. a dashboard-with-drilldown. Swapping the order
  of sections, recolouring, or changing copy is NOT structural → structural-diversity partial/none.
  Common mistakes: three near-identical layouts generated from the same prompt; defending a
  choice by aesthetics; reflection that doesn't mention any AI shortcoming.
---
## Goal
Practise **cheap breadth first**: explore genuinely different directions before polishing one.

## What to do
1. Pick one screen from a current or recent project (or use: "a savings goal overview in a
   banking app").
2. In **Claude Design or Figma Make only**, produce **3 structurally different concepts** for
   that screen. Different structure means a different layout model or interaction — not
   different copy, colours or the order of the same blocks.
3. If the AI keeps giving you the same layout, push it: name the structure you want, ban the
   one it keeps repeating, or describe a different user mindset.
4. Pick one concept and defend it in **3 sentences**.

## What to submit
- One screenshot per concept.
- Your 3-sentence defence, and what the AI got wrong or kept repeating.

**Time:** about 45 minutes.
