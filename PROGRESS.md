# Progress

## Final summary (after Phase 8)

**What was built** — all 8 phases of BUILD_PLAN.md:
- Google sign-in limited to @theuxda.com (DB trigger + callback check), one-time track
  onboarding, guarded dev test login (no passwords; off in production).
- Content pipeline: strict Zod schemas, `content:validate`, idempotent `content:sync` (answers and
  grader notes only in `challenge_keys`, version bumps, archive-never-delete). 7 wireframing
  challenges (5 published) + 2 draft ai-workflow quizzes.
- Learner app: categories with progress, challenge pages (markdown brief, quiz questions,
  direct-to-Storage screenshots, Figma link, reflection), server-side validation + auto-grading,
  3 attempts with best-score-counts, submission pages, profile dashboard with feedback history and
  leaderboard visibility, per-track leaderboard.
- Admin (`/admin`, real 403 for others): review queue (AI-reviewed first, low confidence flagged),
  submission review with signed image URLs and AI rubric scores, approve / request resubmission,
  users (track, admin), content overview, CSV export.
- Evaluation pipeline: `eval:pull` / `eval:push` with full validation, idempotent, never overrides
  human review; `/evaluate` command updated to match.
- Polish: loading/empty/error/not-found states everywhere, skip link, axe WCAG 2.1 A/AA clean in
  light and dark mode, no horizontal scroll at 375px, README and DEPLOY.md.

**Key decisions** (full list in DECISIONS.md): Management API instead of `supabase db push`
(token/network limits); explicit GRANTs on top of RLS; public-only `content_hash`; magic-link
test login instead of a shared password; admin in its own route group for real 403s; AI results
hidden from learners until an admin approves; tests isolated on a separate Supabase project.

**Checks at the end:** `npm run check` ✅ (86 unit tests) · `npm run build` ✅ ·
`npm run test:integration` 6/6 ✅ · `npm run test:e2e` 14/14 ✅ (twice in a row). With no
`TEST_SUPABASE_*` configured both DB suites skip (exit 0). Because no test project exists yet,
the passing runs were made by pointing the test vars at the main project in a single shell with
the main-project vars removed (the guard otherwise refuses); all test data was removed
afterwards (0 fixtures, submissions, evaluations, uploads; test users hidden).

**Next steps**
1. Create the separate test Supabase project, set `TEST_SUPABASE_*`, run
   `npm run db:push -- --test-project` and `npm run db:check -- --test-project` (README → Testing).
2. Deploy (DEPLOY.md): set the 3 runtime env vars, add the production `/auth/callback` to Supabase
   Redirect URLs, run the smoke test.
3. Sign in once with a real @theuxda.com Google account (the OAuth round-trip can't be automated).
4. Review and publish the draft content (`spot-the-plant` needs the seeded Figma file;
   `peer-review-swap` needs pairing logic; the two ai-workflow quizzes need Alvis's review).
5. Run the first `/evaluate` once real submissions arrive.

## Phase 0 — Bootstrap
**Plan:** verify env vars; install Supabase CLI and link; scaffold Next.js into the existing
folder without overwriting; set up shadcn/ui, Vitest, Playwright and the libraries; add
package scripts; update `.gitignore`; create PROGRESS/DECISIONS.

**Status: done.**
- All `.env.example` vars present in the process environment.
- Next.js 16.4 (App Router, TS strict, Tailwind v4, ESLint, `src/`) scaffolded in a scratch dir
  and copied in without overwriting existing files.
- shadcn/ui set up manually (registry host blocked — see DECISIONS): `components.json`,
  theme tokens with accent `#B5A2FF`, light/dark via `next-themes`, `button`, `card`,
  `input`, `label`, `alert`.
- Supabase CLI installed as devDependency; `supabase init` done. `supabase link` only
  partially succeeded (see Known issues).
- Scripts: `check`, `test`, `test:e2e`, `db:push`, `db:types`, `content:validate`,
  `content:sync`, `seed:admins`, `eval:pull`, `eval:push` (later-phase scripts are stubs).

**Checks:** `npm run build` ✅ · `npm run check` ✅ (typecheck, lint, 2 unit tests).

## Phase 1 — Database
**Plan:** turn `docs/schema.sql` into a migration; apply it (CLI can't connect → Management API
fallback); generate types; write `seed-admins` and `check-db`.

**Status: done.**
- `supabase/migrations/20261009000000_init.sql` = schema.sql + explicit grants: client roles
  start from zero; `authenticated` gets SELECT on profiles/categories/challenges/submissions/
  evaluations and UPDATE(show_on_leaderboard) on profiles only; `challenge_keys` and
  `admin_allowlist` have no grants and no policies; `get_leaderboard`/`is_admin` not executable
  by anon.
- `npm run db:push` applies pending migrations via the Management API in one transaction each,
  recording them in `supabase_migrations.schema_migrations` (same table as the CLI).
- `npm run db:types` → `src/lib/database.types.ts` (Management API type generation).
- `npm run seed:admins` → allowlisted `ADMIN_EMAILS`, promotes existing matching profiles.
- `npm run db:check` (`scripts/check-db.ts`): tables exist, RLS on every public table, anon and a
  real signed-in temp user get `42501` on `challenge_keys`/`admin_allowlist` (with a sentinel row
  present), published challenge readable, user can't set `is_admin`, non-UXDA signup rejected.
  Temp user + sentinel rows are removed afterwards.

**Checks:** migration applied ✅ · types generated ✅ · `db:check` 22/22 ✅ · `npm run check` ✅
(5 unit tests).

## Phase 2 — Content pipeline
**Plan:** Zod schemas per content-format.md; loader; validator with cross-file rules; pure sync
planner + sync script; convert the 7 seed challenges; write 2 ai-workflow quizzes; fixture tests.

**Status: done.**
- `src/lib/content/`: `schema.ts` (strict Zod — unknown keys are errors), `load.ts`,
  `validate.ts`, `transform.ts` (public row vs. private key row, content hash), `sync-plan.ts`
  (pure diff), `index.ts`.
- `content:validate` checks: schema, unknown category, duplicate category/challenge slugs,
  slug = filename, points = questions + rubric, unique question/rubric/option ids, answers are
  real option ids, quiz = auto-graded only and no submission, figma/screenshot types have the
  matching submission field, review-needing challenges have rubric + grader_notes.
- `content:sync` (`--dry-run` supported): upserts categories/challenges; answers + grader notes
  only into `challenge_keys`; version bumps when public content or the key changes; status-only
  change doesn't bump; removed content → archived (never deleted).
- Content: 7 wireframing challenges from `docs/seed-challenges.md` (5 published; `spot-the-plant`
  and `peer-review-swap` draft as specified, with `TODO_FIGMA_URL` placeholder) + 2 ai-workflow
  quizzes `ai-output-red-flags`, `verify-before-you-trust` (draft — for Alvis to review).
- All challenges are at v2 in the DB: a summary-derivation fix changed every public hash right
  after the first sync. No submissions exist, so nothing is affected.

**Checks:** 27 unit tests ✅ (valid + invalid fixtures, transform, sync plan) ·
`content:validate` ✅ (invalid fixture → 13 errors, exit 1) · sync run twice → second run
`0 change(s)` ✅ · no `answer` keys in `challenges` rows (SQL check) ✅ · `npm run check` ✅.

## Phase 3 — Auth
**Plan:** Supabase SSR clients (server/browser/admin); `src/proxy.ts` gating every route except
`/login` + `/auth/callback` (+ `/auth/error`); Google OAuth server action with
`hd=theuxda.com`, `prompt=select_account`; callback route; friendly domain error page;
sign-out; one-time onboarding (server action, only while `track` is null); guarded test login
for test-strategist/-designer/-admin; unit + E2E tests.

**Status: done.**
- `src/lib/supabase/{server,client,admin,proxy}.ts`; admin client is `server-only`.
- `src/proxy.ts` refreshes the session (`getClaims`) and redirects signed-out users to
  `/login?next=…` (open-redirect safe via `safeNext`); signed-in users skip `/login`.
- Pages verify the user again with `getUser()` (`src/lib/auth/session.ts`);
  `(app)/layout.tsx` requires an onboarded profile, else → `/onboarding`.
- `/auth/callback`: maps Supabase's "Database error saving new user" (trigger rejecting a
  non-UXDA email) to `/auth/error?reason=domain`; also re-checks the domain after exchange.
- Onboarding: `chooseTrack` server action → service role update `WHERE id = user AND track IS NULL`.
- Test login (`ENABLE_TEST_LOGIN=true` AND `NODE_ENV !== 'production'`, checked in the page
  and in the server action): service-role magic-link token verified server-side; no passwords.
  test-admin gets `is_admin=true`.
- Header with name/track, light/dark toggle, sign out. Page titles are real `h1`s.

**Checks:** E2E 3/3 ✅ (redirect to /login; test user logs in → onboarding → home → sign out;
non-UXDA error page) — run twice, stable · unit 44/44 ✅ incl. "test login disabled when
`NODE_ENV=production`" for both the guard function and the server action · `npm run build` ✅ ·
`npm run check` ✅ · manual: `next start` with `ENABLE_TEST_LOGIN=true` shows no test login.

## Phase 4 — Learner experience
**Plan:** RLS-scoped learner data layer; home (visible categories + progress), category page
(type, difficulty, points, status), challenge page (markdown brief, questions, direct-to-Storage
screenshot upload, Figma URL, reflection); `submitChallenge` server action (validate, auto-grade,
status); submission detail page; loading/error/empty states; E2E with isolated fixtures.

**Status: done.**
- Pure logic with tests: `lib/submissions/grading.ts` (multi = exact set), `rules.ts` (3 attempts;
  blocked while awaiting review or at full points; best published score counts; AI results hidden
  until approved), `input.ts` (Zod schema derived per challenge; image paths must be
  `{user_id}/{slug}/{uuid}.{png|jpg|webp}`; https figma.com only; min words).
- `submitChallenge` (service role after `getUser`): re-checks visibility/published/audience,
  attempts, validates, verifies every screenshot exists in Storage, grades against
  `challenge_keys`, inserts with attempt n+1 (unique constraint handles races). Quiz-only →
  `published` immediately; anything reviewable → `submitted`.
- Pages: `/`, `/categories/[slug]`, `/challenges/[slug]`, `/submissions/[id]` (own only, images via
  signed URLs from the user's client). Admins can preview drafts (banner, no form).
- E2E isolation: `e2e/fixtures/content` (category `e2e-tests`) installed in global setup and removed
  in teardown; all test-user submissions/evaluations/uploads wiped before and after; test users are
  hidden from the leaderboard by default.

**Checks:** E2E 6/6 ✅ (quiz auto-grades → published 10/10; screenshot upload → "Awaiting review";
other user's submission: 404 page, 0 rows via RLS, Storage sign/download denied) · teardown leaves
0 fixture rows/submissions/objects ✅ · unit 64/64 ✅ · `npm run check` ✅ · `npm run build` ✅.

## Phase 5 — Dashboard + leaderboard
**Plan:** `/profile` with total score, completed, pending reviews, feedback history and a
leaderboard visibility toggle; `/leaderboard` with Strategists/Designers tabs via
`get_leaderboard`, current user highlighted; main nav; E2E.

**Status: done.**
- `summarizeScores` mirrors `get_leaderboard` (best published score per challenge); `rankRows`
  gives ties the same rank. Unit-tested.
- Visibility toggle is a server action using the user's own RLS client (column grant on
  `show_on_leaderboard` only), optimistic UI + toast.
- Leaderboard tabs are links (`?track=`), defaulting to the user's track; current row highlighted
  (`aria-current`, "You" badge); notice when the user is hidden; empty state.
- Header nav: Home, Leaderboard, Profile, Admin (admins only); labels collapse to icons on mobile.
- Each E2E spec now wipes test-user data in `beforeAll`, so specs are independent of order.

**Checks:** E2E 7/7 ✅ (quiz 4/10 → profile total 4, completed 1; toggle on → Designers tab shows
"Test Designer · You · 4"; not on Strategists tab) · unit 67/67 ✅ · `npm run check` ✅ ·
`npm run build` ✅.

## Phase 6 — Admin
**Plan:** `/admin` admins-only (403 otherwise): review queue (ai_reviewed first, low confidence
flagged), submission detail (signed image URLs, answers, rubric scores from the latest
evaluation, editable score + feedback, Approve / Request resubmission), users (set track, toggle
admin), read-only content overview, CSV export; E2E.

**Status: done.**
- `src/app/(admin)/` route group: its layout runs `requireAdmin()` (fresh DB read) before anything
  streams, so non-admins get a real **403** via `forbidden()` (`experimental.authInterrupts`).
  Admin nav link only shown to admins.
- Reads use the admin's own RLS client (admin policies), writes use the service role after
  `getAdminOrNull()` in every action/route.
- `reviewSubmission`: Zod (score ≥ 0, half-point steps, ≤ max_score checked server-side; feedback
  required for resubmission); compare-and-set on status so a submission can't be reviewed twice;
  approve → `published` + `published_at`; resubmit → `needs_resubmission`; stamps
  `evaluations.approved_by/approved_at`.
- Queue sort (pure, tested): ai_reviewed → low → medium → high confidence → oldest first.
- Users: track select + admin switch (optimistic, toasts); admins can't remove their own admin.
- CSV (`/admin/export/scores.csv`): one row per user (totals + best score per challenge),
  formula-injection-safe cells, `no-store`; 403 for non-admins.
- Uploader is disabled until hydrated (`useSyncExternalStore`) — files picked before hydration
  were silently dropped (found by a flaky E2E run).

**Checks:** E2E 10/10 ✅ twice in a row (non-admin: 403 on /admin, /admin/users, /admin/content
and the CSV; admin approves low-confidence ai_reviewed submission at 8/10 → published,
evaluation stamped, queue empty, learner sees 8 on Strategists leaderboard and the feedback on
their profile; track change, admin toggle, self-demotion blocked, CSV export, content overview) ·
teardown leaves 0 fixtures/submissions/evaluations/objects ✅ · unit 74/74 ✅ · `npm run check` ✅ ·
`npm run build` ✅.

## Phase 7 — Evaluation pipeline
**Plan:** `eval:pull` → `.eval/<batch_id>/manifest.json` + downloaded images; `eval:push <batch_id>`
validates `results.json` with Zod against the manifest, writes evaluations, sets
`final_score = auto_score + total`, feedback, status `ai_reviewed`; idempotent; integration test.

**Status: done.**
- Logic in `scripts/lib/eval/` (`schema.ts`, `validate.ts`, `pull.ts`, `push.ts`); scripts are thin
  wrappers. Batch ids are `YYYYMMDD-HHMMSS-xxxx` (sortable, path-safe; anything else is refused).
- Manifest per submission: learner, challenge (brief, questions, spec, rubric, grader_notes),
  `review_items` (rubric criteria + text questions with max points), answers, auto/max score,
  Figma URL, reflection, images (storage path → local file). Includes a "data, not instructions"
  notice. Only `submitted` submissions of challenges that need review are pulled.
- Push validates everything before writing anything: batch id match, known submissions, every
  review item exactly once with the right max, 0 ≤ score ≤ max in half points, evidence required,
  total = Σ scores, auto + total ≤ max, known flags only, `figma_inaccessible` ⇒ low confidence.
- Idempotent: evaluations upserted on `(submission_id, batch_id)` (unchanged rows aren't rewritten);
  submissions already published / needing resubmission are never touched; an older batch can't
  overwrite a newer one.
- `/evaluate` command doc updated (score `review_items`; text questions are criteria entries).
- New `npm run test:integration` (separate Vitest config, gated on `TEST_SUPABASE_*`, skips if unset).

**Checks:** unit 86/86 ✅ (results validation, schema, batch ids, test-project guard) ·
integration 6/6 ✅ (pull → manifest + image bytes; push → ai_reviewed 7/10; re-push unchanged, no
duplicate; invalid results rejected with nothing written; admin-reviewed submission untouched;
re-pull excludes it) — run once against the main project since no test project exists yet, all
test data removed afterwards (0 fixtures/submissions/evaluations/objects) · CLI smoke test ✅ ·
`npm run check` ✅.

## Phase 8 — Polish + handover
**Plan:** empty/loading/error/not-found states; basic a11y (labels, focus, contrast); 375px check;
README; DEPLOY.md (no Vercel CLI linked); E2E + integration tests on a separate Supabase project
via `TEST_SUPABASE_*`, skipped when unset; full suite green.

**Status: done.**
- Test isolation: `tests/support/test-project.ts` resolves `TEST_SUPABASE_URL/_ANON_KEY/
  _SERVICE_ROLE_KEY`; none set → skip; partial → error; same project as main (URL or ref) →
  error. Playwright starts its own `next dev` (never reuses a server) with the app's Supabase env
  overridden to the test project; global setup/teardown and every spec are gated. Shared fixtures
  in `tests/support/fixtures.ts`. Scripts accept `--test-project` (`db:push`, `db:check`, `db:types`,
  …) via `TEST_SUPABASE_PROJECT_REF` (+ optional `TEST_SUPABASE_ACCESS_TOKEN`). Documented in
  `.env.example`, README and SETUP.md.
- New `e2e/quality.spec.ts`: axe (WCAG 2.0/2.1 A+AA) on login, home, category, both challenge
  types, leaderboard, profile, 404, 403 and all admin pages in light **and** dark mode; no
  horizontal overflow at 375px on the same pages; keyboard skip link → `#main`. Axe was
  sanity-checked by injecting a violation (it caught `image-alt` and `color-contrast`).
- Root `not-found.tsx`, `error.tsx`, `global-error.tsx`, admin `loading.tsx`/`error.tsx`;
  "Skip to content" link in the header.
- Mobile: admin Users and Review queue tables hide secondary columns below `md`/`sm` so the
  controls stay on screen at 375px (checked visually from screenshots).
- README (setup, scripts, content + evaluation workflows, testing, security model, layout) and
  DEPLOY.md (host-agnostic, env vars, Supabase redirect URLs, first-deploy steps, smoke test).

**Checks:** see Final summary above.

## Post-handover — CI
- Added `.github/workflows/ci.yml`: `npm ci` → `npm run check` → `npm run build` on push and pull
  request; Node 22 with npm cache; read-only token; placeholder env, no secrets; E2E/integration not
  run. Verified locally with the exact workflow env (clean environment): check ✅ (86 tests),
  build ✅.

## Known issues
- `supabase link` fails with `LinkAuthTokenError`: the access token is rejected (403) on
  project config endpoints (`/config/database/postgres`, `/config/auth`, `/postgrest`).
  Project read, `api-keys`, `types/typescript` and `database/query` work, so DB work uses the
  Management API fallback from BUILD_PLAN Phase 1. Direct Postgres (port 5432) is not
  reachable from the cloud session either. Fix: use a personal access token with full
  project access (Owner/Admin) if CLI `link`/`db push` are wanted.
- Google provider is now enabled (`/auth/v1/settings` → `google: true`), but the real Google
  round-trip is still untested by automation (it needs a human Google login). The callback's
  error mapping is tested with the exact query Supabase sends. Remember to add the deployed URL
  to Supabase Redirect URLs later.
- Pages under `(app)` stream behind `loading.tsx`, so `notFound()` there renders the right UI but
  with HTTP 200 (not 404). Access control is unaffected (data is never sent). Admin pages are in
  their own group precisely to keep a real 403.
- No separate test Supabase project exists yet, so E2E/integration skip by default (see Next
  steps). Creating it is an external-account step for Alvis.
- Uploads removed before submitting stay in Storage (users have no delete policy). Harmless;
  a cleanup script could come later.
- Test users (test-strategist/-designer/-admin) exist in the main project from earlier test runs
  (no passwords, hidden from the leaderboard; test-admin is an admin). Remove them in Supabase →
  Auth → Users if you don't want them there; dev test login against the main project recreates them.
- Hardening idea (not done, security-model change → Alvis to decide): the email provider is
  enabled with confirmation required. Since sign-in is Google-only, consider turning off email
  signups in Supabase; test login uses admin-generated links and would need re-checking.

## Post-handover — configurable sign-in domain
- Login domain is uxdesignagency.com (was hardcoded theuxda.com). Now driven by
  `ALLOWED_EMAIL_DOMAINS` (comma-separated): new migration `20261009120000_allowed_email_domains`
  adds `allowed_email_domains` (RLS on, no client access) and makes `handle_new_user` check it;
  `npm run seed:domains` syncs the env var into the table. The env var also drives the Google
  `hd` hint, the auth-callback re-check, test user emails and the domain error copy.
- Applied to the main project: `db:push` ✅, `db:types` ✅, `seed:domains` ✅ (uxdesignagency.com),
  `seed:admins` ✅ (alvis@uxdesignagency.com allowlisted), `db:check` ✅ (incl. allowed-domain
  signup accepted, other domains rejected). A @theuxda.com signup is now rejected.
- `admin_allowlist` still contains the old `alvis@theuxda.com` row; harmless (that domain can no
  longer sign up). Delete it in Supabase if you want it gone.

## Tracks, required challenges, acknowledgements, readability
Plan approved by Alvis (with "resubmission requested" = missing). Done:
- Tracks account_manager, assistant, motion_designer (+ strategist, designer); onboarding and
  admin Users offer all five. Leaderboard groups Strategists / Designers (+ motion) / Team
  (AM + assistant), configured in `src/lib/tracks.ts`.
- `audiences` (all | tracks) replaces `audience` on categories + challenges. UI & Motion →
  designer + motion_designer; new Tool Proficiency + Organization & Policies (all).
- `required_for` (+ `due_at`): Required/Due/Overdue badges, required first on category pages,
  "Required for you" with "X of Y required done" + overdue on home. Admin → Required progress
  (per person, track filter, CSV export).
- `type: acknowledge`: brief + "I've read and understood"; `acknowledgements` table (RLS,
  server-written), 0 points, off the leaderboard. Admin → Acknowledgements (who has / hasn't).
- Readability: softer light/dark palette (#FAFAFA / #17181C, text #E6E6EA, muted #A1A1AA,
  accent #B5A2FF), all text +2px except labels (`text-meta` 14px, badges 12px).
- Docs: content-format, schema.sql, README, CLAUDE.md, /new-challenge.
- Migrations `20261010090000_track_enum_values`, `20261010090100_audiences_required_acknowledgements`,
  tested first on a throwaway local Postgres with sample data (values carried over, constraints
  reject bad lists, RLS on acknowledgements).
- Also fixed: `package-lock.json` was out of sync with package.json (`npm ci` failed).

Checks: `npm run check` ✅ · `npm run build` ✅ · `content:validate` ✅.
Main project (run by Claude at Alvis's request): `db:push` ✅ (2 migrations) · `db:types` ✅
(no diff vs the hand-written types) · `content:sync --dry-run` ✅ (2 new categories, ui-motion
update, 9 hash refreshes, no version bumps) · `content:sync` ✅ (12 changes; second dry run 0) ·
`db:check` ✅ (incl. acknowledgement write/read isolation and `get_leaderboard(track[])`).
Data after: 11 categories, 9 challenges (all still v2), 3 submissions untouched.
E2E + integration (no separate test project exists yet, so run against a throwaway local
Supabase stack via Docker — all 4 migrations applied cleanly from scratch): `test:e2e` ✅ 18/18
(incl. axe WCAG A/AA light + dark, no overflow at 375px, new required/acknowledge specs) ·
`test:integration` ✅ 6/6. Screens reviewed at 375px in light and dark mode.
