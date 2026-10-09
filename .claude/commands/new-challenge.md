---
description: Create a new challenge from a plain-language description
argument-hint: <describe the challenge>
---

Create a challenge from this description: $ARGUMENTS

## Steps
1. Read `docs/content-format.md`, `content/categories.yaml`, and the frontmatter of every
   file in `content/challenges/` (to avoid duplicates and match tone).
2. **Pick the category and audiences.** Tracks: `strategist`, `designer`, `motion_designer`,
   `account_manager`, `assistant` (see `src/lib/tracks.ts`).
   - Choose the single best-fitting existing category.
   - `audiences`: omit it to inherit the category's audiences. Set it only to **narrow** them
     (e.g. `[motion_designer]` inside UI & Motion) — a challenge can never widen its
     category's audiences. Use `all` or a list of tracks, never both.
   - If nothing fits well, propose a NEW category (slug, title, audiences, description,
     sort_order) and add it to `categories.yaml`. Say so explicitly in the summary.
3. **Required or optional?**
   - Only set `required_for` when the description says it's mandatory for someone
     ("everyone must…", "all designers need to…"). Otherwise leave it out (optional).
   - `required_for: all` means every track, so the challenge and its category must be
     visible to everyone; otherwise list the tracks. Every listed track must be able to see it.
   - If a deadline is mentioned, add `due_at` (ISO 8601 with offset, e.g. `2026-11-01T17:00:00Z`).
     If it's required but no deadline is given, ask in the summary instead of inventing one.
4. **Pick the type:**
   - `acknowledge` for "read and confirm" content (new rules, policies, announcements): just the
     brief and an "I've read and understood" button. No questions, submission, rubric or
     grader_notes; omit `points` (it's 0) and `difficulty`.
   - `quiz` if everything has an objective answer; `screenshot` / `figma` if they must produce
     work; `mixed` if both.
5. **Gather context.** If the description mentions internal docs and a Google Drive
   connector is available, read them. Base questions and answers only on those docs or
   on the description — never invent UXDA processes. If something is unclear, write it
   into the summary as an open question instead of guessing.
6. **Write** `content/challenges/<slug>.md` with `status: draft`:
   - A clear brief: goal, what to do, what to submit, time estimate.
   - Every challenge other than quiz or acknowledge has a reflection prompt that makes them evaluate the AI's
     output (what was wrong, what they changed, why).
   - Quiz options: one clearly correct answer, plausible distractors, no "all of the above".
   - Rubric: 2–5 criteria, each with full / partial / none levels that are observable in a
     screenshot, Figma frame or text. No vague criteria like "good quality".
   - `grader_notes`: what a strong answer contains and common mistakes.
   - Points follow the guideline and add up exactly.
   - Acknowledge briefs: state what changed and what people must do differently, in plain
     language. Skip the rules above about rubrics, reflections and points.
7. Run `npm run content:validate`. Fix until it passes.
8. Reply with a short summary: title, category (+ why), audiences, required_for (+ due_at),
   type, difficulty, points, rubric criteria, any new category, any open questions.
9. Wait for approval. On "approve": set `status: published`, run `npm run content:sync`,
   commit `content: add <slug>`. On change requests: edit, re-validate, re-summarise.
