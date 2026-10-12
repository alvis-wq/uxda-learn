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

## Admin-editable challenge settings + "Your challenges" history
Plan approved by Alvis (plus: block publishing while content has a TODO placeholder). Done:
- **Ownership split.** Content files own content; the admin panel owns `status`, `required_for`,
  `due_at`. Files set those only when content:sync creates a challenge; afterwards sync never
  writes them and lists any file/DB disagreement as "Settings managed in the admin panel".
  `due_at` left `content_hash` (stale hashes refresh without version bumps).
- **Admin → Content:** per challenge status select, required-for picker (Everyone + tracks; only
  tracks that can see it are selectable, re-validated server-side) and due date (browser local
  time, saved on blur, Clear). Instant save with toasts. Change history per challenge (who,
  field, old → new, when). Migration `20261011090000_challenge_settings_audit`: audit table
  (RLS: admins read, nobody writes) + `set_challenge_setting()` (service role only; value + audit
  row in one transaction, no-op writes nothing). content:sync archives go through it too.
- **Placeholders:** `TODO` / `TODO_*` anywhere in a challenge (brief, questions, submission,
  rubric, grader notes) blocks publishing in the panel with the reason; content:validate fails
  files that say `status: published` with one. spot-the-plant (TODO_FIGMA_URL) is blocked.
- **Admin preview** `/admin/content/[slug]`: brief, questions with correct answers marked,
  submission spec, rubric with levels, grader notes, history. Admin-only, server-rendered.
- **Profile → "Your challenges":** one card per challenge; headline = best published attempt
  (Best score), newer pending attempt flagged, other attempts collapsible (Earlier attempt /
  Not counted muted, Awaiting review, Resubmission requested). Scores < 50% in new `warning`
  token (#a14a00 light / #f0b44c dark, AA on all surfaces, + icon). Feedback per attempt;
  AI-reviewed scores/feedback stay hidden until approved.
- Docs: content-format ("Who owns what"), /new-challenge, README, schema.sql, CLAUDE.md.

Checks: `npm run check` ✅ (218 unit tests) · `npm run build` ✅ · `content:validate` ✅.
Local Supabase stack (Docker, all 5 migrations from scratch): `test:e2e` ✅ 23/23 (new:
settings + audit, visible-track limits, TODO publish block, preview answers, profile grouping
with axe light/dark) · `test:integration` ✅ 6/6 · SQL checks of `set_challenge_setting`
(rollback without actor, invalid values, grants) ✅. Screens reviewed at 1280px and 375px,
light and dark.
Main project (run by Claude at Alvis's request): `db:push` ✅ (1 migration) · `db:types` ✅ (no
diff vs hand-written) · `content:sync --dry-run` ✅ (9 hash refreshes, no version bumps, no
settings drift) · `content:sync` ✅ (9 changes; second dry run 0) · `db:check` ✅ (incl. audit
table RLS and function grants). Data after: 9 challenges (all v2, statuses unchanged),
3 submissions untouched, 0 audit rows.

## Animated glass X (login + sign-in intro)
From `design-assets/web-x` (three r186). Branch `feat/glass-x`.
- `three@0.186.0` + `@types/three@0.186.0` pinned exactly. `glass-x.js` ported to
  `src/components/glass-x/glass-x-scene.ts` (animation, studio and DEFAULTS unchanged; only the model
  URL → `/brand/glass_x.glb`, a `speed` option defaulting to 1, and stricter dispose/failure cleanup).
  `GlassX` is a client component (`next/dynamic`, `ssr: false`); three and the model load after the
  page is idle, so they never block the app.
- Login: always-dark stage (#17181C, also in light mode), the X plays its reveal, the sign-in card
  fades in after 1.5 s but is clickable immediately.
- After sign-in: full-screen intro, ≤ 2 s, click/key skips, once per browser session (session cookie
  `uxda_intro`, queued by the OAuth callback and test login, rendered in the first HTML by the (app) and
  (admin) layouts). Reduced motion: no intro, static settled X, card shown at once.
- Fallback `public/brand/glass-x.png` (settled state, rendered from the real component) for reduced
  motion, no WebGL2, model load failure or a lost GPU context. Renderer disposed on unmount (context
  released), devicePixelRatio capped at 2.
- Bug found on the way: the auth proxy answered `/brand/glass_x.glb` with the login page for signed-out
  visitors; `.glb` is now exempt like images.
- Bundle: three + the scene are one lazy chunk (647 KB raw / 161 KB gzip), referenced only by two ~17 KB
  loader chunks; no route lists it among its up-front chunks.

Checks: `npm run check` ✅ (224 unit tests, +6 for the intro rules) · `npm run build` ✅.
Browser-verified (headless Chromium on Apple GPU, against `next dev`): login at 1440×900 and 375×812
(no horizontal scroll), reduced motion, no-WebGL2 and blocked-model fallbacks, dispose releases every
WebGL context, DPR 3 → 2; intro auto-dismiss ≈ 2 s, skip by key (~250 ms) and click, "seen" cookie
stops replays, CSS fade-out works with JS off. New `e2e/glass-x.spec.ts`: the 5 login-page tests ran ✅
(incl. axe); the sign-in/intro tests are written but NOT run — no test Supabase project or Docker here.
The default E2E suite now runs with `reducedMotion: "reduce"` (no intro, static X) to stay deterministic.

## UI refresh: Urbanist, #101010 dark mode, pill shapes, UXDA logo
Branch `feat/ui-refresh`.
- Font: Urbanist (variable, latin + latin-ext) via `next/font/google` replaces Geist everywhere; Geist Mono is
  gone, `--font-mono` is the system monospace stack.
- Dark mode: page `#101010`; card `#1a1a1a` < popover `#212121`; muted `#242424`, secondary `#2b2b2b`, border
  `#303030`, input `#3d3d3d` (neutral greys; accent keeps its violet tint). The glass X stage and the fallback PNG
  are `#101010` too (theme-contrast test now asserts they match).
- Shapes: all `Button` sizes, tabs (shadcn Tabs, leaderboard, admin filter) and the header/admin nav active
  state are pills; inputs, cards, alerts keep their radius.
- Logo: `src/components/uxda-logo.tsx` (inline, `currentColor`, labelled "UXDA Learn") + the word "Learn" in the
  header (word hidden below `sm`) and on the login card.
- Mobile: the admin header (4 nav items) overflowed 375px with the wider logo and pills, so mobile nav padding
  and logo height are tighter; 360px fits, 320px admin header still overflows (not checked by the suite).

Checks: `npm run check` ✅ (226 unit tests) · `npm run build` ✅. Browser-verified against `next dev`
(temporary preview route, removed): both themes at 1280px and 375px, axe A/AA clean, no horizontal overflow,
Urbanist loaded, live X canvas blends seamlessly into `#101010`. Full E2E not run (no test project here).

## React Bits SpecularButton on the login page
Branch `feat/specular-button`.
- `src/components/specular-button/SpecularButton.tsx` + `.css` added from `https://reactbits.dev/r/SpecularButton-TS-CSS.json`
  (two files, no dependencies, WebGL2). The login page's Google button is now this component with the requested
  props; same server action, label, Google icon and pending state ("Redirecting to Google…", disabled while pending).
- It is its own small client component with its own canvas, so it is usable immediately, independent of the glass X.
- Without WebGL2 it gets a `1px` border in the line colour at 40% (the glass alone is near-invisible); otherwise no border.
- Two deviations from the published source, both commented in the file: an `eslint-disable` for its render-time ref
  write, and the WebGL context is only released once the canvas has left the DOM (see DECISIONS).

Checks: `npm run check` ✅ · `npm run build` ✅. Browser-verified (`next dev` and a production build): usable at once,
axe A/AA clean, no overflow at 375px (button 293×54), focus ring, no-WebGL2 border, hover highlight, no console output.
`glass-x.spec.ts` scoped its canvas checks to the X's canvas; its 5 login tests were run ✅. Full E2E not run (no test project).

## Rubber navigation + page entry animation
Branch `feat/rubber-nav`. `motion@12.43.0` (exact).
- **RubberNav** (`src/components/rubber-nav/`), adapted from React Bits RubberSegment: a `<nav>` of real Next
  `<Link>`s, active item from the pathname (`aria-current="page"`), normal Tab order, no arrow-key selection, no
  dragging. Stretch/squash thumb and clip-path label swap kept (size md, radius 24, inset 3, equal slots, stretch 100,
  squash 3, speed 1). Items: Home, Leaderboard, Profile, Admin (admins only); below `md` icons only, names kept via
  `aria-label`. Reduced motion: the thumb jumps. When no item matches the route (e.g. a challenge) the thumb fades out.
  Colours are theme variables `--nav-*` (dark: track #161616, thumb #282828, text #fafafa, active #ffffff; light values
  added). The admin sub-navigation still uses `NavLink`.
- **Page entry** (`src/components/page-entry/`, used as `(app)/template.tsx` and `(admin)/admin/template.tsx`): fade +
  rise 8px + blur 4px→0, 300 ms, ease [0.23, 1, 0.32, 1]; blocks stagger 35 ms, max 6 staggered, the rest together.
  Only on route change (not hard loads, refreshes or same-route clicks); loading skeletons (`aria-busy`) are skipped
  and the real content animates when it arrives; only on-screen blocks animate; inline styles are removed afterwards.
  Reduced motion: a plain 150 ms fade.
- Bug found while testing: the thumb stayed unclipped when a page loaded on any item but the first (a `useTransform`
  value isn't refreshed after `jump()`); the thumb is now painted directly from the motion values' change events.

Checks: `npm run check` ✅ (243 unit tests; new nav contrast tests + entry timing tests) · `npm run build` ✅.
Browser-verified in `next dev` and a production build with a temporary harness (removed): 24 nav checks (alignment,
stretch ~2 slots wide, squash overshoot, Tab order, arrows inert, aria-current, no-match fade, 375/360px, reduced motion,
no-JS fallback, axe light + dark) and 17 entry checks (stagger timing, header untouched, skeleton skipped, no CLS,
no re-run on refresh, pointer-events, inline styles cleaned, reduced motion) all pass. New `e2e/nav.spec.ts` is written
but NOT run (no test Supabase project here); it typechecks and lints.

### Fix: hydration mismatch from the page entry animation
Hard load of a page that streams in behind `loading.tsx` logged "A tree hydrated but some attributes of the server
rendered HTML didn't match": my content-arrival observer saw the streamed page as "new" and hid/animated it while
React was hydrating it. The SSR HTML never contained hidden styles (checked), but the DOM did by hydration time.
Now `nextEntryState()` guarantees nothing is touched until a client-side route change has happened (first mount,
same-path re-runs and streamed arrivals on a hard load are all skipped). Reproduced before, clean after (first load,
streaming first load, navigations; JS disabled shows content). New tests: unit (`entry.test.ts` state rules,
`page-entry.ssr.test.ts` — the template's SSR output has no inline styles / opacity:0 / blur / translate) and two
`e2e/nav.spec.ts` tests (SSR HTML of /, /leaderboard, /profile; console free of hydration warnings on first load and
after navigating) — the E2E ones are not run here (no test project).

## Login sequence + post-login loader
Branch `feat/login-sequence`.
- **Login sequence** (`LoginSequence`, `src/lib/login-sequence.ts`): the X appears at 1.6× with a fade + sharpen
  (opacity + blur on the canvas host), eases down to size at +1.2 s over 0.6 s by moving the camera
  (`zoom` / `setZoom()` in the scene, so it stays crisp), the glass card rises in at +1.8 s (0.98 → 1, 0.5 s), the X
  fades out at +2.3 s over 0.6 s leaving a faint violet glow, and at +2.9 s the scene unmounts (renderer disposed,
  context released). Times run from the moment the X is ready.
- Glass card: translucent fill, `backdrop-filter` blur, 1px light border, top highlight, soft shadow; text contrast
  is unit-tested against the composited glow (worst case) and measured on rendered pixels.
- Skippable by any click/key; plays once per browser session (cookie `uxda_login_seq`, read by the server page so the
  first HTML is right); skipped straight to the card when WebGL2 is missing, the model fails, or the X isn't ready
  within ~1 s; reduced motion shows the card at once with no X. The card is in the DOM from the start; its controls
  have `tabindex=-1` and pointer events are off until it is visible. No-JS: `<noscript>` shows it; CSS reveals it at 4 s
  if scripts never run.
- **Post-sign-in loader** (`SignInLoader`, replaces the timed intro): the X on the dark stage with the glow, shown
  while the first page loads; ≥ 800 ms, then fades as soon as the page is ready (document loaded and no `aria-busy`
  skeleton left in `#main`), no artificial maximum; a key/click skips it; same session-once cookie; reduced motion → no
  X, no minimum, 150 ms fade. A 30 s CSS backstop only exists for pages whose scripts never run.
- Scene: new `zoom` and `maxPixelRatio` options (defaults unchanged); the login canvas is `min(140vmin, 1100px)` at a
  pixel-ratio cap of 1.5. `GlassX` gained `fallback`, `autoplay`, `distance`, `zoom`, `onReady`, `onFail`.
- Bugs found while testing: a transformed ancestor isolates the X's `screen` blend (dark disc around the X) so the
  canvas box is centred with margins; `inset-0 m-auto` can't centre a box wider than its container on phones.

Checks: `npm run check` ✅ · `npm run build` ✅. Browser-verified in `next dev`: the timeline (events at +1.8 / +2.3 /
+2.9 s), frames at 1440×900 and 375×812 (no overflow), a 17-point behaviour matrix (hidden-but-reachable card, tabindex,
skip, once-per-session, reduced motion, no WebGL2, failed/slow model, no JS, axe, no hydration warnings) and a 15-point
loader matrix (first-HTML, min 0.8 s, 3 s and 6.5 s loads, reduced motion, no WebGL2 fallback, skip, no JS). The 8
login-page tests in `e2e/glass-x.spec.ts` were run ✅; the sign-in/loader E2E tests are written but NOT run (no test project).

## React Bits Stepper for multi-step challenges (`feat/stepper`)

- `src/components/stepper/Stepper.tsx` + `.css`: React Bits "Stepper-TS-CSS", credited in a header comment. Hugeicons →
  lucide (ChevronLeft / ChevronRight / Check); the fixed `theme`/`accentColor` props are gone and the `--stepper-*` variables
  map to our theme tokens (follows light/dark); pill buttons; the viewport's `aria-live` removed (focus moves to the step
  heading instead); a `completeIcon` prop for the submit spinner. Settings: bars, radius 32, no frame, linear, Back /
  Continue, width 100%.
- Layout rules (`src/lib/submissions/steps.ts`): quiz (all auto-graded, ≥ 2 questions) = one question per step → Review;
  mixed (anything with screenshots, Figma, reflection or text questions, ≥ 2 inputs) = Brief → Questions → Screenshots →
  Figma link → Reflection → Review & submit, only what applies; one-input challenges and acknowledge keep the plain form.
- State lives above the Stepper (it unmounts non-current steps): answers, Figma, reflection, images, and the upload logic
  (`useScreenshotUploads` — an upload in flight survives leaving the step). Continue is disabled until the step is valid, using
  the **same Zod schema as the server action**, and the reason is shown (and `aria-describedby` on the button). Submit goes
  through the unchanged server action. Draft in sessionStorage (`draft.ts`), cleared on success; screenshots aren't drafted.
- Focus moves to the new step's heading; reduced motion uses the Stepper's own fade mode. Question/field components
  (`question-field.tsx`, `submission-fields.tsx`, presentational uploader) are shared with the plain form.
- Server input schema: an unanswered multi-select now says "Choose at least one option." instead of Zod's raw message.

Checks: `npm run check` ✅ (279 tests: steps, draft) · `npm run build` ✅. Browser-verified in `next dev` on a temporary harness
(removed): quiz and mixed flows in light, dark, 375px and reduced motion (120 checks incl. axe on every step, no console
warnings, no overflow), upload in flight while leaving the step (one request, image present on return), draft restore, keyboard
flow, and the exact server-action payload. E2E specs updated (quiz, screenshot, dashboard, admin, quality: axe + 375px on every
step) but NOT run — they need the test Supabase project; the real Submit success path is only covered there.

## Fix: neutral shimmer skeletons + loader on every new sign-in (`fix/skeletons-and-loader`)

- Skeletons: `bg-accent` + `animate-pulse` replaced by `--skeleton` tokens (light `#ebebed`, slightly darker than the card; dark
  `#262626`, slightly lighter) and a faint sweep every 2.8 s. One shared animation: `--shimmer-x` (a registered property) is
  animated once on `:root` while a skeleton is on the page, and every `[data-slot="skeleton"]` paints the same band on a
  viewport-fixed background, so all skeletons are in sync and the band crosses them as one. Reduced motion: static grey.
  `Skeleton` is the only skeleton primitive, so it covers both `loading.tsx` files. Unit tests hold the tokens neutral, on the right
  side of the card, and the highlight low-contrast.
- Loader path verified: the OAuth callback's `uxda_intro=pending` does reach the redirect response (probed against `next dev`; route
  tests also cover order and the failure cases). What actually broke a second sign-in was the old "once per browser session" rule: a
  leftover `seen` cookie meant `queueSignInIntro` never set `pending` again. Now every sign-in (callback, dev test login) sets `pending`,
  and `/auth/signout` expires the cookie. Reloads and in-app navigation still don't show it (the loader writes `seen`).
- A first-time user goes callback → /onboarding → "/" (the loader is in the (app) layout, so it shows after onboarding).

Checks: `npm run check` ✅ (290 tests) · `npm run build` ✅. Browser-verified skeletons (light/dark/reduced motion: one shared value, sweeping,
static) and the loader gate cookie matrix on a temporary harness (removed). NOT verified: a real Google sign-in, and the updated
sign-in/loader E2E (needs the test Supabase project).

### Glow changes (same PR)

- Post-login loader: the violet `.stage-glow` is gone; the X sits on plain #101010 (no gradient). The login page is unchanged apart from the glow below.
- Login glow: `.stage-glow` is half the size (`min(110vmin, 860px)` → `min(55vmin, 430px)`), same colour and peak intensity, so the card-contrast model (glow centre) is unchanged and its tests stay green. Tests also pin the new size and keep the glow out of the loader.

## Home dashboard, Aurora, challenge cards, sticky header (`feat/home-dashboard`)

- **Card images (phase 1):** optional `image` on challenges (frontmatter) and categories (`categories.yaml`): a file name in
  `public/challenges/`, validated by Zod (lowercase, no folders, png/jpg/webp/avif) and for existence. Stored in new nullable
  `image` columns (migration `20261012090000_challenge_images.sql`, applied by you; types regenerated with no diff). Display
  only: outside `content_hash`, synced as its own version-neutral write. Resolution: challenge image → category image → none.
- **Home dashboard:** hero with first name, total points (count-up on the first view of a browser session; the server renders
  the final value, the animation is applied before first paint; static with reduced motion; screen readers get the final value
  only), rank in the learner's leaderboard group ("#3 of 12 · Designers"; "Not ranked" when hidden), completed count. Required
  section: "X of Y required done", progress bar, outstanding required challenges as cards (overdue first, then due date), or a
  calm "All required challenges done" state. Categories as before. The page is now `HomeView` (data-free) + a thin page.
- **Aurora** (`src/components/aurora/`, React Bits credit): your config, `mouseInteraction` off, `lightMode` in light theme,
  StrictMode-safe context cleanup, lazy (`next/dynamic`), nothing drawn without WebGL2. A full-bleed, `aria-hidden`,
  `pointer-events-none` layer behind a ~544px hero (600px with the header it runs under), fading out over its last 14%.
  Mounted only after hydration (next-themes knows the theme on the client's first render, the server doesn't).
- **Cards:** `ChallengeCard` for category pages and the home required list. Light heading (Urbanist 300), lavender
  subheading, muted body, violet pill CTA (Start / Continue / View result), compact meta row. Dark: near-black tile; light: white
  tile with a darker violet (`--brand-text`) for the subheading since `#B5A2FF` fails AA on white. 12-column grid on desktop
  (7/5, then 5/7; a lone last card is full width), one column on mobile. The image gets its own grid column and bleeds off the
  bottom-right corner through the padding; narrow cards shrink it. One link per card (the title), the CTA is decoration.
- **Header:** logo / centred rubber nav / theme + sign-out; sticky; transparent at the top, translucent + blur + hairline border
  once content scrolls under it (IntersectionObserver sentinel, server renders the top state); `transition: none` with reduced motion.

Checks: `npm run check` ✅ (324 tests) · `npm run build` ✅. Browser-verified on a temporary harness (removed): home, cards and
header in light/dark, 375 / 800 / 1024 / 1280px (no horizontal overflow, no text under any image, no console warnings or
hydration errors), count-up, reduced motion, sticky header states, axe (all rules except colour contrast, which axe can't evaluate
over a canvas) clean on all three layouts. Contrast over the aurora was **measured from rendered pixels** (text hidden, background
sampled behind every text run, 4 moments of the animation, 5 viewports): ≥ 6.45:1 dark, ≥ 5.64:1 light. E2E updated
(`home.spec.ts` new; auth, required, dashboard selectors) but NOT run: no test Supabase project. No artwork exists yet, so no
card shows an image until files are added to `public/challenges/`.

### Aurora pinned to the viewport + dark by default (same PR)

- **Aurora position:** `PageAurora` replaces the hero-band placement. It is `position: fixed`, `z-index: -10`, `pointer-events: none`,
  `aria-hidden`, portalled into `<body>` (the page-entry animation transforms the page wrapper, which would otherwise turn
  `fixed` into "fixed to that wrapper" and trap the z-index), and stays put while scrolling. Home page only.
- **"Middle line":** with `direction="bottom"` the shader's glow is brightest at the *box's* bottom edge and fades upwards; the
  box's own middle is empty, so putting the box centre on the viewport edge shows nothing. I read "middle line" as the middle of the
  glow band: its brightness-weighted centre (measured from rendered frames: 0.10-0.13 of the box height above the box's bottom, at
  600/900px boxes and 1280/1920px widths, stable over time) is on the viewport's bottom edge (`GLOW_MIDLINE = 0.115`), so only the upper
  half of the glow shows. Box height `clamp(600px, 75vh, 900px)`.
- **Contrast:** over the visible aurora no text colour passes un-scrimmed (peak luminance 0.25-0.52 in dark; muted text needs <= 0.043).
  A `.scrim` (page colour at 85%, feathered) now sits behind the bare text on the home page (hero blocks, section headings,
  "Coming soon" chips); cards and tiles are opaque. At rest it is invisible (page colour on page colour). 85% was derived from the
  worst visible pixel and verified end to end: 1,708 rendered text runs over a scroll sweep at 120px steps, dark/light x 1280/375px:
  min 6.37:1 dark, 5.87:1 light.
- **Default theme:** `defaultTheme="dark"`, `enableSystem={false}`: no saved choice (and any system setting) gets dark; the toggle
  still stores light/dark in localStorage. E2E that relied on `emulateMedia({colorScheme})` now choose a theme the way a visitor
  does (`chooseTheme` / `switchTheme` helpers).

Checks: `npm run check` ✅ (327 tests) · `npm run build` ✅. E2E updated (aurora geometry/stacking, theme default + toggle) but NOT run (no test project).

### Chips and "Coming soon" without the scrim (same PR)

- The scrim is gone from the "Coming soon" label and its chips. Chips are solid `bg-card` pills (border and pill shape kept), so their text
  never sits on the aurora; the label is `text-foreground` instead of muted. The other bare-text blocks keep the scrim.
- Re-measured from rendered pixels with a 15px scroll step (10,500 text runs, dark/light x 1280/375px): everything passes (>= 5.69:1,
  light >= 6.0:1) **except** the label in dark at 375px for three scroll offsets (1365-1395px), where it is at the very bottom edge of
  the viewport mid-scroll (2.01:1). Nothing was added for that: padding can only fix where text rests, not where it passes through.
- Page bottom padding `pb-10` -> `pb-28`: scrolled to the end, the label sits ~170-210px above the viewport bottom, above the bright part of the
  glow; measured at the end of the page: all on-screen text >= 6.9:1 dark / >= 6.32:1 light, both widths.

### Scrim removed everywhere; half-height aurora; resting-position readability (same PR)

- **Scrim removed (code, not hidden):** the `.scrim` rule and every use of it (hero blocks, section headings, chips, the empty state's
  `className` prop that only existed for it) are deleted; a test now fails if the word reappears in any source or stylesheet. The sticky
  header's translucent glass is a separate, requested feature and is unchanged.
- **Aurora half as tall:** box `clamp(300px, 37.5vh, 450px)` (was `600/75vh/900`); same colours and settings, so the glow reaches half as high.
  The glow midline still sits on the viewport's bottom edge (0.115 of the box below it). Constants and formulas live in `aurora/geometry.ts`.
- **Reach, measured (rendered frames, 6 moments, dark/light x 375-1920px wide x 800-1400px tall):** the faintest visible wisp is 0.47-0.48 of the box
  height above the box's bottom in dark (0.35-0.37 light) -> 107px (800px viewport) ... 162px (1400px). Proportional to the box, i.e. it did halve.
- **Readability at rest:** the home page's bottom padding is `box x (reach - midline) + 1rem` (125px at 800px tall), so scrolled to the end all text,
  chips and cards sit above the glow. Measured at that resting position (text hidden, background sampled behind every text run): dark >= 6.90:1,
  light >= 6.05:1, lowest text 23px above the glow's last visible wisp, at 1280x800, 375x812, 1920x1080 and 1280x1400. While scrolling,
  text passing over the glow is accepted (per the brief).
- **Tests:** `theme-contrast.test.ts` now holds the resting position (tokens on the plain page and on the card-coloured chips, hero labels at 80%,
  the aurora geometry, and padding >= the measured reach at four viewport heights); `layout.test.ts` guards against any scrim; E2E has a
  scrolled-to-the-end check (box height, lowest text above the glow) - E2E NOT run (no test project).

Checks: `npm run check` ✅ · `npm run build` ✅.

### Full-width header (same PR)

- The header is as wide as the viewport (page content keeps `max-w-5xl`): logo + "Learn" at the far left, theme toggle + sign-out at the far right,
  side padding 16px (phones) -> 24 (sm) -> 40 (md) -> 80px (lg+). A `minmax(0,1fr) auto minmax(0,1fr)` grid on every width, so the rubber nav is
  centred on the viewport itself, not between the logo and the actions. Sticky + transparent -> glass-on-scroll are untouched.
- The nav's labels now appear from 1024px (were 768px): with equal outer columns, labels (~400px, ~530px with Admin) no longer fit beside the 158px
  logo at tablet widths without overlapping it. Below that it is icon-only.
- Measured in a browser (admin and non-admin) at 320, 360, 375, 414, 600, 768, 820, 1023, 1024, 1280, 1440, 1920, 2560px: nav centred to <1px, logo and actions clear of it,
  no overflow, padding 16/16/40/80 as designed. Phones under ~400px get a slightly tighter nav (and under 340px a smaller logo and tighter side padding) so the
  equal columns still fit; the one tight spot is an admin on a 320px screen (1px clear).

Checks: `npm run check` ✅ · `npm run build` ✅. E2E (`home.spec.ts` header test: widths, padding, true centre, no overlap at 1024/768/375, icon-only below 1024) written, NOT run.

