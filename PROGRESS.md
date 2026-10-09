# Progress

## Current state (after Phase 3)
Phases 0–3 done: Next.js app scaffolded; DB schema live on Supabase with RLS + explicit grants;
content pipeline syncing 9 categories / 9 challenges; auth (Google OAuth flow, proxy gating,
onboarding, guarded dev test login) working end to end via test login.
**Next step:** Phase 4 — learner experience (home with categories/progress, category page,
challenge page with uploads, submit server action with auto-grading).
**Needs Alvis:** enable the Google provider in Supabase (see Known issues) — real Google
sign-in can't work until then.

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

## Known issues
- `supabase link` fails with `LinkAuthTokenError`: the access token is rejected (403) on
  project config endpoints (`/config/database/postgres`, `/config/auth`, `/postgrest`).
  Project read, `api-keys`, `types/typescript` and `database/query` work, so DB work uses the
  Management API fallback from BUILD_PLAN Phase 1. Direct Postgres (port 5432) is not
  reachable from the cloud session either. Fix: use a personal access token with full
  project access (Owner/Admin) if CLI `link`/`db push` are wanted.
- **Google provider is not enabled in Supabase** (`/auth/v1/settings` → `google: false`), so
  "Sign in with Google" currently fails. Needs SETUP.md step 3 (Google OAuth client, Internal
  consent screen, paste client ID/secret into Supabase → Auth → Providers → Google) and
  Redirect URLs `http://localhost:3000/**` (+ deployed URL later). Can't be done from here
  (requires creating an OAuth client — a stop condition), and the access token can't read or
  change auth config (403). Everything else is tested via test login.
- Real Google OAuth round-trip is therefore untested; the callback's error mapping is tested
  with the exact query Supabase sends.
- Hardening idea (not done, security-model change → Alvis to decide): the email provider is
  enabled with confirmation required. Since sign-in is Google-only, consider turning off email
  signups in Supabase; test login uses admin-generated links and would need re-checking.
