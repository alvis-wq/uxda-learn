# Progress

## Current state (after Phase 6)
Phases 0–6 done. Learners sign in (Google or dev test login), choose a track, browse categories
and challenges, submit quizzes (auto-graded, published instantly) or screenshot/Figma/reflection
work (awaiting review), see scores/feedback on their profile and the Strategists/Designers
leaderboard. Admins get a review queue, submission review (approve / request resubmission),
user management (track, admin), a read-only content overview and a CSV score export.
All checks green: `npm run check` (74 unit tests), `npm run build`, E2E 10/10 (two consecutive
full runs).
**Next step:** Phase 7 — evaluation pipeline (`eval:pull` / `eval:push`, idempotent; the admin
review UI already reads `evaluations` rows in the shape `/evaluate` writes).
**Needs Alvis:** sign in once with a real @theuxda.com Google account to confirm the OAuth
round-trip (automated tests can't drive Google), and pick a track on first login (admins too).

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
- E2E runs against the single real Supabase project: it adds a temporary `[E2E] Test challenges`
  category (visible to signed-in users for ~2 minutes) and wipes test-user data before/after.
  If a run is killed mid-way, the next run or `npm run content:sync` cleans it up.
- Uploads removed before submitting stay in Storage (users have no delete policy). Harmless;
  a cleanup script could come later.
- Test users (test-strategist/-designer/-admin) exist in the project with no passwords; they're
  hidden from the leaderboard after each E2E run, but using test login manually can leave a
  newly created test user visible until the next E2E run.
- Hardening idea (not done, security-model change → Alvis to decide): the email provider is
  enabled with confirmation required. Since sign-in is Google-only, consider turning off email
  signups in Supabase; test login uses admin-generated links and would need re-checking.
