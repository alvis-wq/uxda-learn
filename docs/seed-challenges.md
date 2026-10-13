> **Superseded (2026-10-13):** the launch content in `content/challenges/` replaced these seed challenges (the old files were removed and `content:sync` archives them). Kept for the background only.

# Seed challenges — category: wireframing (strategist)

Convert each into `content/challenges/<slug>.md` per docs/content-format.md.
Write a full brief, a rubric with levels, and grader_notes. Points must add up.
Every challenge must include a reflection asking what the AI got wrong or what they changed.
Keep all as `status: draft` unless marked publish — Alvis reviews before publishing.

Context: the team has three wireframing tools —
Claude Design (with UXDA wireframe design system), Figma Make (UXDA Make Kit), and
Claude Code with the uxda-wireframes plugin (`/new-screen`, `/new-flow`, `/check`,
`/format`, handoff commentary). Intended workflow: iterate in Claude Design / Make first,
use Claude Code only at the end to connect to the Figma library, check, annotate
(Purpose & trigger, Logic & behavior, Assumptions, Open questions) and apply governance
formatting.

1. **same-brief-three-tools** (difficulty 2, publish)
   Same brief (card freeze/unfreeze flow, 4–5 screens) built in all three tools.
   Submit screenshots from each + reflection: strengths/weaknesses, time and cost per tool.
   Habit: knowing which tool fits which stage.

2. **diverge-before-you-commit** (difficulty 1, publish)
   In Claude Design or Make only, produce 3 structurally different concepts for one screen
   (not copy or order changes). Pick one and defend it in 3 sentences.
   Habit: cheap breadth first.

3. **spot-the-plant** (difficulty 3, draft — Alvis provides the seeded Figma file;
   use `TODO_FIGMA_URL` placeholder)
   A "finished" AI-built flow with 5–6 seeded errors (detached component, off-library
   element, missing error state, dead-end screen, broken back path, an assumption written
   as fact). Find them BEFORE running `/check`, then run it and compare.
   Answer key in grader_notes lists the seeded errors. Habit: review, don't trust.

4. **interrogate-the-ai** (difficulty 2, publish)
   Ask Claude Design why it chose a layout/component, then push back with a real constraint
   (regulatory, edge case, returning user). Submit screenshots of the conversation +
   reflection: where it held, caved too easily, or was wrong.

5. **edge-case-hunt** (difficulty 2, publish)
   Take an AI-generated happy-path flow, list every missing state (empty, loading, error,
   partial data, timeout, permission denied), then design the 3 most important.

6. **handoff-only-round** (difficulty 3, publish)
   Take a Make/Claude Design flow into Figma; use Claude Code only for the final pass
   (library connection, `/check`, `/format`, handoff commentary). Rewrite at least one
   AI-generated annotation per category and explain why yours is better.
   Submission: Figma node URL + screenshots + reflection.

7. **peer-review-swap** (difficulty 2, draft — needs pairing logic later)
   Review a colleague's finished flow against a rubric (grammar, states, annotations,
   library compliance); flag one thing the AI got wrong that the author missed.
