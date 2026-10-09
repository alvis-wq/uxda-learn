# Build plan

Execute phases in order. Work autonomously; the human is not watching.

## Execution loop (every phase)
1. Read the phase. Write a short plan under the phase heading in `PROGRESS.md`.
2. Implement.
3. Run the phase's acceptance checks plus `npm run check` (typecheck + lint + unit tests).
4. If a check fails: diagnose, fix, re-run. Up to 3 attempts per failing check.
5. Still failing → switch to a simpler approach, log it in `DECISIONS.md`, try once more.
6. Still failing → if it doesn't block later phases, record it under "Known issues" in
   `PROGRESS.md` and continue. If it blocks, STOP and report.
7. Mark the phase done in `PROGRESS.md` with check results, then commit.

## Decision policy
When a choice comes up, decide yourself using this priority:
1. Security and data correctness
2. Matches CLAUDE.md and the docs
3. Simplest thing that works
4. Fewest new dependencies
5. Most conventional Next.js / Supabase pattern

You may decide without asking: libraries within the stack, file structure, component
design, naming, copy, error messages, refactors, test approach.

## Stop conditions (stop and report clearly what you need)
- Missing or invalid env vars / credentials, or an external service rejects auth
- Something requires creating an external account, project or OAuth client
- A destructive DB operation on tables that contain data
- Changing the allowed email domain or the security model
- Anything that costs money
- The same blocker persists after the loop above, or 2 phases in a row end blocked

## Phase 0 — Bootstrap
- Verify all vars in `.env.example` exist in `.env.local` (stop if not).
- Scaffold Next.js (TypeScript, App Router, Tailwind, ESLint, `src/` dir) in the current
  folder without overwriting existing files. Init shadcn/ui. Add Vitest, Playwright, Zod,
  `@supabase/supabase-js`, `@supabase/ssr`, `gray-matter`, `yaml`, `tsx`.
- package.json scripts: `check`, `test`, `test:e2e`, `db:push`, `db:types`,
  `content:validate`, `content:sync`, `seed:admins`, `eval:pull`, `eval:push`.
- `.gitignore` includes `.env.local`, `.eval/`.
- Create `PROGRESS.md`, `DECISIONS.md`.
**Checks:** `npm run build` and `npm run check` pass.

## Phase 1 — Database
- Turn `docs/schema.sql` into a migration under `supabase/migrations/`; `npm run db:push`.
- `npm run db:types` → `src/lib/database.types.ts`.
- `scripts/seed-admins.ts`: upsert `ADMIN_EMAILS` into `admin_allowlist`, and set
  `is_admin=true` on any matching existing profiles.
- `scripts/check-db.ts`: verifies tables exist, RLS enabled on all public tables, and an
  anon/authenticated client cannot read `challenge_keys`.
**Checks:** migration applied, types generated, `check-db` passes.

## Phase 2 — Content pipeline
- Zod schemas per `docs/content-format.md`; loader for `/content`.
- `content:validate`: schema errors, unknown category, duplicate slugs, points mismatch,
  question ids unique, rubric ids unique.
- `content:sync`: upsert categories, challenges, keys (answers + grader_notes into
  `challenge_keys`, never into `challenges`). Compute `content_hash`; bump `version` when it
  changes. Content removed from disk → `archived=true`, never deleted.
- Convert `docs/seed-challenges.md` into challenge files. Write 2 short quiz challenges in
  `ai-workflow` about critically reviewing AI output.
**Checks:** unit tests with valid + invalid fixtures; validate passes; sync run twice →
second run reports 0 changes.

## Phase 3 — Auth
- Google sign-in via Supabase (`hd=theuxda.com`, `prompt=select_account`), callback route,
  middleware protecting all routes except `/login` and auth callback, sign-out.
- Friendly error page for non-UXDA accounts (DB trigger rejects them).
- First login with no track → onboarding page to choose Strategist / Designer
  (server action, only allowed while `track` is null; admin can change later).
- Dev test login (guarded per CLAUDE.md) that creates/uses test users:
  test-strategist@, test-designer@, test-admin@theuxda.com.
**Checks:** E2E: test user logs in, completes onboarding, reaches home. Unit test: test
login is disabled when `NODE_ENV=production`.

## Phase 4 — Learner experience
- Home: categories visible to the user, progress per category.
- Category page: challenges with type, difficulty, points, status for this user.
- Challenge page: brief (markdown), questions, screenshot upload (direct to Storage at
  `{user_id}/{challenge_slug}/{uuid}.{ext}`), Figma URL, reflection, submit.
- Server action: validate input, auto-grade auto-gradable questions, create submission with
  the right status. Show submission state, feedback, and resubmit when allowed.
**Checks:** E2E: quiz challenge auto-grades and publishes; screenshot challenge uploads and
shows "Awaiting review"; user cannot see another user's submission.

## Phase 5 — Dashboard + leaderboard
- Profile: total score, completed challenges, pending reviews, feedback history,
  leaderboard visibility toggle.
- Leaderboard: tabs Strategists / Designers via `get_leaderboard`, highlight current user.
**Checks:** E2E: published score appears on dashboard and correct leaderboard tab.

## Phase 6 — Admin
- `/admin` (admins only): users (set track, toggle admin), review queue (ai_reviewed first,
  low confidence flagged), submission detail with images via signed URLs, rubric scores,
  editable feedback and score, Approve / Request resubmission. Read-only content overview.
  CSV export of scores.
**Checks:** E2E: non-admin gets 403; admin approves an ai_reviewed submission → published
→ appears on leaderboard.

## Phase 7 — Evaluation pipeline
- `eval:pull`: fetch submissions with status `submitted` that need review → writes
  `.eval/<batch_id>/manifest.json` (submission, challenge brief, questions, user answers,
  rubric, grader_notes, figma_url, local image paths) and downloads images.
- `eval:push <batch_id>`: validate `.eval/<batch_id>/results.json` with Zod (shape in
  `.claude/commands/evaluate.md`), insert evaluations, set submission
  `final_score = auto_score + rubric total`, `feedback`, status `ai_reviewed`.
  Idempotent: re-pushing the same batch doesn't duplicate.
**Checks:** integration test using a test submission and a fixture results.json.

## Phase 8 — Polish + handover
- Empty, loading, error states everywhere; `not-found` and `error` pages; basic a11y
  (labels, focus, contrast); responsive check at 375px.
- README: setup, scripts, content workflow, evaluation workflow.
- If Vercel CLI is linked: deploy a preview and run a smoke test against it. Otherwise
  write `DEPLOY.md` (env vars, Supabase redirect URLs to add).
**Checks:** full suite green (`npm run check`, `npm run test:e2e`, `npm run build`).
Final summary in `PROGRESS.md`: what was built, decisions, known issues, next steps.
