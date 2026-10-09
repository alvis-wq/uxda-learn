---
description: Create a new challenge from a plain-language description
argument-hint: <describe the challenge>
---

Create a challenge from this description: $ARGUMENTS

## Steps
1. Read `docs/content-format.md`, `content/categories.yaml`, and the frontmatter of every
   file in `content/challenges/` (to avoid duplicates and match tone).
2. **Pick the category and audience.**
   - Choose the single best-fitting existing category.
   - Audience: use the category's audience unless the description clearly targets
     a different group (e.g. a wireframing task that designers should also do → `all`).
   - If nothing fits well, propose a NEW category (slug, title, audience, description,
     sort_order) and add it to `categories.yaml`. Say so explicitly in the summary.
3. **Pick the type:** `quiz` if everything has an objective answer; `screenshot` / `figma`
   if they must produce work; `mixed` if both.
4. **Gather context.** If the description mentions internal docs and a Google Drive
   connector is available, read them. Base questions and answers only on those docs or
   on the description — never invent UXDA processes. If something is unclear, write it
   into the summary as an open question instead of guessing.
5. **Write** `content/challenges/<slug>.md` with `status: draft`:
   - A clear brief: goal, what to do, what to submit, time estimate.
   - Every non-quiz challenge has a reflection prompt that makes them evaluate the AI's
     output (what was wrong, what they changed, why).
   - Quiz options: one clearly correct answer, plausible distractors, no "all of the above".
   - Rubric: 2–5 criteria, each with full / partial / none levels that are observable in a
     screenshot, Figma frame or text. No vague criteria like "good quality".
   - `grader_notes`: what a strong answer contains and common mistakes.
   - Points follow the guideline and add up exactly.
6. Run `npm run content:validate`. Fix until it passes.
7. Reply with a short summary: title, category (+ why), audience, type, difficulty, points,
   rubric criteria, any new category, any open questions.
8. Wait for approval. On "approve": set `status: published`, run `npm run content:sync`,
   commit `content: add <slug>`. On change requests: edit, re-validate, re-summarise.
