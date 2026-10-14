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

### Login X sequence plays on every load (same PR)

- The once-per-session rule is gone. The sequence plays on every load of `/login`: fresh visit, reload, after sign-out. The `uxda_login_seq`
  cookie, `LOGIN_SEQ_COOKIE`, `loginSequenceInitial` / `LoginSequenceInitial`, the server page's cookie read and the `initial` prop are deleted
  (a test fails if any of them reappears). The server always renders the "play" state (card hidden, with the existing CSS and `<noscript>` safety nets).
- Unchanged: click/key skips to the card, reduced motion shows the card at once (also on reload), no WebGL2 or an X that isn't ready within ~1 s goes straight to
  the card. The post-login loader and its `uxda_intro` cookie are untouched.
- Browser-verified (16 checks in `next dev`): fresh visit, two reloads and a re-navigation all play; click and key skip, and the next load plays again; no login-sequence
  cookie; reduced motion on first load and on reload; no WebGL2; a 3 s model and an aborted model both reach the card (~1.2 s and ~0.35 s). `e2e/glass-x.spec.ts` updated
  (plays on every load, plays again after sign-out), the sign-out one NOT run (no test project).

Checks: `npm run check` ✅ · `npm run build` ✅.

## Login intro sound (`feat/login-sound`)

- `public/brand/login-intro.mp3` (4 s, trimmed with a fade-out; was 6 s) belongs to the X sequence. **Off by default**; a speaker toggle (`aria-label="Sound on/off"`,
  `aria-pressed`) in the top-right corner of the login stage turns it on/off, remembered in localStorage (`uxda:login-sound`: "on" / "off"; guarded, falls back to
  the page view if storage is unavailable).
- On: it starts when the X sequence starts (`onReady`, position 0). Turned on mid-sequence it starts at the sequence's position (`soundStartOffset(elapsed)`),
  nothing starts if the sequence is over. Off never plays, and stops what is playing. A click or any other key skips the sequence and fades the sound out
  linearly over 300 ms (an explicit rAF ramp, `fadeVolume`, then pause and volume reset); Enter/Space/click on the toggle itself are not "skip" gestures.
- Reduced motion: no sound unless the toggle is on; on, it plays at once (there is no sequence). No WebGL2 / an X that gives up: no sequence, so no sound.
- Autoplay: `play()` is guarded (sync and promise); a blocked autoplay stays silent with no console output or page error. `<audio preload>` is `auto`
  only while the sound is on, `none` otherwise. Server and first client render use "off" (stored value read after hydration).
- `src/proxy.ts`: `.mp3` added to the auth matcher's static exclusions (like `.glb`): the audio request is made before sign-in and would otherwise get the login HTML.

Checks: `npm run check` ✅ · `npm run build` ✅. Playwright E2E for the sound (7 specs in `e2e/glass-x.spec.ts`, with a stubbed audio element) all pass here through a scratch config; axe clean and no overflow or card overlap at 1280/375px, sound off and on. Browser-verified in `next dev` (20 checks: default off, toggle label/pressed/corner, turn-on mid-sequence starts at ~0.7 s without
skipping, remembered on reload, off stops it and is remembered, on after the sequence starts nothing, key and click skips stop it, blocked autoplay silent, reduced motion
on/off) and the fade ramp measured per frame on a light page (1 -> 0.09 over ~0.3 s, paused at 329 ms, volume restored). A caveat of this machine: software GL makes Playwright's own
clicks/keys take seconds on the page while the X renders, so a few checks drive the page in-page instead.
- Known: the existing spec "login: the X plays, the glass card fades in…" is timing-sensitive under this machine's software GL; it fails the same way on `main` without these changes (checked by stashing), so it is not affected by the sound work.
- Clip shortened from 6 s to 4 s: `LOGIN_SOUND_DURATION_S` is 4 and `soundStartOffset` now prefers the loaded file's real `audio.duration`, so a future clip change needs no code edit.
  Nothing else assumed 6 s (the sequence ends at 2.9 s, so the clip now outlives it by ~1.1 s instead of ~3.1 s; mid-sequence turn-on still always has room, tested; the skip fade only
  applies during the sequence and is unaffected). The E2E position bound now uses the constant.


## Server-side drafts + challenge tip (`feat/server-drafts`)

- Migration `20261013090000_submission_drafts.sql` (applied by you, `db:types` regenerated): table `submission_drafts` (PK `user_id, challenge_slug`; `challenge_version`,
  `answers` jsonb, `figma_url`, `reflection`, `image_paths`, `current_step`, `updated_at`; size/shape checks) with select/insert/update/delete policies on `user_id = auth.uid()`
  and **no** `is_admin()` clause; and `challenges.tip` (text, <= 1000 chars). `docs/schema.sql` updated. `npm run db:check` gained 5 checks (own read/write, anon sees none,
  shape limits, can't write another user's draft, an admin can't read or edit another user's draft), all passing on the main project.
- Autosave (`draft-actions.ts` `saveDraft`): session check, visibility and attempts (service role, as for a submit), the new `draftInputSchema` (partial answers allowed; known question ids/options,
  the learner's own screenshot paths up to the max, nothing for fields the challenge lacks), the write under the learner's own session (RLS is the hard stop). A blank form deletes the row.
  A page rendered from an older version is refused (`stale`). The client (`Autosaver`, `draft-autosave.tsx`) saves 1 s after the last edit and at once on a step change, one save at a time,
  retries with growing delay, flushes when the tab is hidden or the form unmounts, and pauses around submit. A quiet `role=status` line shows Saving… / Saved / "Couldn't save yet".
- Restore (`restoreDraft`, `prepareFormDraft`): the page reads the draft on the server (no hydration remount any more; the sessionStorage draft is gone). Answers whose question ids/options still exist
  are kept, anything else is dropped and, when the version changed, the note says some answers were reset. Screenshot paths are checked as the learner's own and looked up in Storage via signed URLs
  (a missing file is dropped). "Continue where you left off · saved N ago" with a two-click **Start over** (`discardDraft`).
- `submitChallenge` deletes the draft after the insert (best effort). Cards (home required list + category page) and the challenge header show **In progress** (and the CTA says Continue) when a draft
  exists and the learner can still submit; `needs_resubmission`/retries show it next to their status.
- `tip` in frontmatter (<= 1000 chars, markdown): `TipBox` above the questions (first questions step of a stepped challenge; above the plain form otherwise). Display-only like `image`: not in `content_hash`;
  a change is a version-neutral `challengeDisplayUpdates` write in content:sync (replaces `challengeImageUpdates`); TODO placeholders in it are caught. Documented in `docs/content-format.md`, `/new-challenge`.

Checks: `npm run check` ✅ · `npm run build` ✅. Unit: `restoreDraft`, `isBlankDraft`, `draftInputSchema` (incl. "anything a complete submission accepts passes"), the autosave timing rules (fake timers), `saveDraft`/`discardDraft`/
submit-deletes-draft against a fake DB, tip schema/hash/sync/placeholders, card CTA. Browser-verified on a temporary harness (deleted): restored step + tip + reset note, an edit triggers the autosave and an
unauthenticated save shows the error line instead of crashing, Start over's confirm toggles, 1280 dark and 375 light, no horizontal overflow. `e2e/drafts.spec.ts` (8 specs: tip placement, save and restore across
sign-out and a second browser, In progress on the card, privacy, version change, Start over, screenshots, submit deletes) and the learner spec's reload step are written but NOT run (no test project).

### Profile: "In progress" group (`feat/server-drafts`)

- `/profile` → "Your challenges" starts with an **In progress** group when there are drafts (hidden otherwise): one row per challenge with its title, category, "saved N ago" (`timeAgo`, moved out of the
  draft notice into `utils.ts`) and a Continue button (`aria-label="Continue <title>"`) to the challenge, most recently saved first. The rule is the cards' one (`inProgressChallenges`: a draft + an open attempt
  via `attemptState().canSubmit`) plus "still visible to the learner" (published, their track, category not archived), because each row links to it.
- A challenge with a draft and earlier attempts shows once, in this group, with "Best so far: X / Y" (the best published attempt, from its own `max_score`); it is filtered out of the history list, so the
  "Submitted" list below (that subheading appears only when both groups exist) never repeats it. The stats are unchanged. With drafts but no other attempts the "No attempts yet" empty state is not shown.
- Tests: `in-progress.test.ts` (rule parity, best score, visibility, ordering), `timeAgo`; 3 more specs in `e2e/drafts.spec.ts` (not run here, no test project). Checked on a temporary page at 1280 dark / 375 light: no overflow, long titles wrap, the link's accessible name is unique.

## Content reset before launch (`chore/content-reset`)

- `content/challenges/` is now exactly the 14 challenges you listed (13 new files, `verify-before-you-trust` rewritten); the 8 old seed files are gone, so `content:sync` archives them
  (never deletes: they have submissions). `npm run content:validate` passes as is: 11 categories, 14 challenges (13 draft, 1 published), no format fixes needed, no wording touched.
  `docs/seed-challenges.md` is marked superseded.
- `scripts/reset-user-data.ts` (`npm run reset:users -- [emails] [--apply]`): deletes submissions (+ evaluations by cascade), acknowledgements, drafts and Storage screenshots of the given accounts (accounts stay), and
  always removes the leftover test accounts (`test-strategist@`, `test-designer@`, `test-admin@` on the first allowed domain) completely. Dry run by default, listing counts per account; `--apply` deletes, then re-reads
  and fails loudly if anything is left. Exact addresses only (no wildcards). Argument parsing is unit-tested (`reset-args.test.ts`); the script itself has NOT been run (not against the live database, as asked, and there is no test project).

## Home: category pills, and progress on in-progress cards (`feat/home-pills`)

- **Pills** (`components/category-pills.tsx`): the categories move to directly below the hero (above "Required for you") as a `<nav aria-label="Categories">` of real links to `/categories/<slug>`. Each pill is 36px tall (`h-9`: the
  header nav's `--rn-h`, and our default button), fully rounded like the buttons, card fill with a border and the 3px focus ring; it shows the title, a compact `done/total`, and a lavender dot while required challenges are left.
  The count and dot are decoration; a screen-reader-only text carries "— 1 of 4 completed, 2 required to do" (so e2e's `toContainText("0 of 3 completed")` still holds). The row wraps from `sm`, and below it scrolls sideways
  (`overflow-x-auto`, no scrollbar) inside the page gutters. A category with no visible challenge gets no pill. The big "Categories" card section and the "Coming soon" chips are gone (the screen-reader `h2` "Categories" stays
  for the row). With no categories at all the page shows the "No challenges yet" empty state in the row's place.
- **Draft progress** (`components/draft-progress.tsx`, `lib/challenges/draft-progress.ts`): "Step 2 of 5" and a segmented bar in the Stepper's bar style (4px bars, 6px gap, primary on the input track, steps up to the current one filled).
  Computed from the draft's `current_step` and the number of steps the challenge's Stepper has now (`planSteps`, the same count the Stepper's own eyebrow shows), a step past the current plan held at the last one. Null for a challenge
  without a Stepper (single-step), so nothing extra shows there. Shown on challenge cards (home required list, category page), just above the meta row, and in the profile's In progress rows. The card queries now also select
  `questions,submission_spec` (public columns, no answers) to count the steps; only the count reaches the client.
- Checks: `npm run check` and `npm run build` ✅. Checked on a temporary page rendering the real `HomeView`: 1280 and 375 px, dark and light, axe (wcag2a/aa/21aa) clean in all four, no horizontal page overflow, pills 36px, 5 pills for
  6 categories (the empty one hidden), keyboard focus ring present, order hero → pills → required. Found and fixed one overflow: the pills' screen-reader-only text was positioned against the page rather than the scrolling row,
  so it stretched the page to 844px at 375 (now `relative` on each pill). e2e: updated `drafts.spec.ts` (Step 2 of 3 on the card and the profile row) and two new `home.spec.ts` specs; none run here (no test project).

### Home order, Overall progress, two-row card meta (`feat/home-pills`)

- **Order on `/`**: greeting, points, rank (the "Completed" stat is gone) → **Overall progress** (`3 of 13 challenges completed`, one bar, and `Required: 1 of 4 done · 1 overdue` when the learner has required challenges;
  it replaces the bar under "Required for you") → **Categories** (label + pills) → **Required for you** (outstanding required cards only, then a muted hint) . No "All challenges" section. `HomeData.overall` counts every challenge
  the learner can see (acknowledge ones included, like the category counts); `required.optionalRemaining` is visible, not required, not done.
- **Hint** (`optionalHint`, tested): required left → "9 more optional challenges in the categories above." (hidden at 0); none left → "All required done. 9 optional challenges are waiting in the categories." ("All required done."
  alone at 0). The "Required for you" section shows only when the learner has required challenges at all.
- **Section labels**: one small, muted style (`SectionLabel`, the "Total points" style) for Overall progress, Categories, Required for you, and the profile's In progress / Submitted.
- **Cards, two rows at every width** (home, category pages): row 1 = type, difficulty, points, time on one line that never wraps; row 2 = Required, due/overdue, status, step progress (inline text + short bar), best score. To make row 1
  fit the narrow cards (the artwork column left only ~200px; even compacted it overflowed) the two rows now sit in a full-width footer band under the artwork's column (`bg-tile`, above the artwork, below the card-wide link),
  and row 1 is 12px with 14px icons. Measured with the longest realistic content ("Screenshots · Hard · 100 pts · ~120 min") at 320/375/768/1024/1280, home and category layouts: row 1 fits at every width from 375 up and no page overflows;
  at 320 only that worst case is clipped. Row 2 may wrap inside itself when it holds many badges.
- Fixed on the way: the pills row blew its grid column out to 660px at 375 (`min-w-0` on the nav); cards got `min-w-0` for the same reason.
- Checks: `npm run check` ✅ (430 tests) · `npm run build` ✅. Temporary page rendering the real `HomeView` and the card grid, 320-1280 px, dark and light: axe (wcag2a/aa/21aa) clean, no horizontal overflow from 320 up.
  E2E updated (required/dashboard/home specs; hint, overall count, card rows) but not run: no test project.
- To look at: no challenge artwork exists yet in `public/challenges/`, so I could not see how an image sits above the new footer band (it is tucked behind it, as before it bled off the card's bottom edge).

## Home: categories as a filter (`feat/home-filter`)

- **Pills filter the list in place.** An "All" pill comes first (overall done/total, a dot while any required challenge is left), then one per category; the pills keep their done/total and lavender dot. Choosing one
  calls `history.pushState` (`?category=slug`, no param = All), which Next syncs into `useSearchParams`, so the list filters on the client at once: no navigation, no fetch (measured 60-130 ms to the new list, 0 document requests, same
  `window`). Reload, back/forward and a shared link show the same filter; an unknown slug means All. The pills are still real `<a href="?category=…">` (new tab, copy link work; modified clicks are left to the browser).
  The selected pill is filled like the active nav item (the nav's thumb on its track tokens: white on grey in light, #282828 on #161616 in dark) and has `aria-current="true"`; on a phone the row scrolls to keep it in view
  (the row only, never the page). A polite `role="status"` line says "Showing …: N challenges". Colour transition and the list's 200 ms fade-in are off under reduced motion.
- **One "Challenges" section** replaces "Required for you" and the optional hint (`optionalHint` removed). Order (`sortHomeChallenges`, server-side, filter-independent): 1) in progress, most recently saved first (a required one stays here
  with its Required badge), 2) required not done: overdue, then due date, undated last (a required one awaiting review after those to do), 3) other not started in category order then easiest first, 4) completed last.
  Empty filter: "Nothing here yet." (not reachable today, since categories without a visible challenge get no pill, but it is there).
- Data: `HomeData.challenges` (every visible card, sorted) replaces `required.outstanding/optionalRemaining`; `CardChallenge` gained `categorySlug` and `savedAt`. The category pages are unchanged. Nothing on the home page links to
  them any more (the pills were the links); the challenge page's back link and any old link still work.
- Checks: `npm run check` ✅ (439 tests) · `npm run build` ✅. A temporary page rendering the real `HomeView` in a browser: filtering, URL, back/forward, reload, bogus param, Enter on a focused pill, 1280/375, dark/light, axe
  (wcag2a/aa/21aa) clean, no overflow, pills 36px, the fade is `none` under reduced motion. E2E rewritten for the new layout (home, required specs), not run: no test project.

## Header logo: "Learn" on the logo's baseline (`fix/logo-baseline`)

- New `UxdaLockup` (header and login card) puts the word on the line the logo letters stand on, from font metrics and no pixel nudge: the row is `align-items: baseline` (an SVG's baseline is its bottom edge), the word has
  `line-height: 0` (zero-height box: the row is exactly as tall as the logo, so the lockup stays centred where the logo alone was), and the logo is moved down by `(1 - 35.6738/36)` = 0.906% of its own height
  (`translateY(%)`), because the flat-bottomed letters X, D, A end at 35.6738 of the 36-tall viewBox (the U overshoots to 36). The (R) mark is ignored. Works at any logo or text size.
- Measured by scanning screenshots at 8x for the lowest ink row of the logo's flat letters against the lowest row of the "L": before, "Learn" stood 3.9 CSS px above the logo's bottom in the header and 6.75 px above it on the login card
  (centre alignment); after, 0 device px of difference at DPR 1, 2, 3 and 8 for header desktop (dark and light), login card desktop and mobile (the header hides "Learn" below 640px). A sweep of 7 logo/text size pairs
  (12-64px logo, 12-48px text) is 0 px at 8x in every case, and an in-page probe on the word's baseline equals the letters' line to 0.00002px. `e2e/logo-baseline.spec.ts` asserts the same (not run: no test project).

## Management track and per-question results (`feat/management-track-results`)

- Track `management` ("CEO and COO"): `tracks.ts` (Team group), onboarding icon, admin Users select (both read `TRACKS`), `docs/schema.sql`, `database.types.ts` (edited by hand until `db:types` is re-run), content docs and `/new-challenge`. Migration `20261014090000_management_track.sql`; not applied yet, waiting for `db:push`.
- Attempt page (`/submissions/[id]`) and the admin review page mark each single/multi question Correct (✓) or Incorrect (✗); wrong answers show the right answer when `answerReveal` allows it (full marks or 3 attempts used), otherwise "Try again to find the right answer — N attempts left." New `results.ts` (+ tests), `attempt-results.ts` (server-only), `--success` token with contrast tests.


- After submitting an auto-graded quiz both forms go straight to `/submissions/[id]` (score, ✓/✗ per question, reveal rules, "Try again" while attempts remain). Review-bound submissions are unchanged. E2E learner and dashboard specs updated for the new landing page (not run: no test project).

## Order questions, Latvian letters and fixes (`feat/order-question-and-fixes`)

- `order` question kind end to end: Zod (authored + public), `content:validate` (unique ids and labels), sync (shuffled public items, ordered key), grading, submission and draft schemas, drafts restore, results (✓/✗, reveal as a numbered list), admin content preview, docs and `/new-challenge`. `OrderField` with drag handle (mouse, touch, keyboard via dnd-kit) and Move up/down buttons.
- "Try again" button on cards beside "View result" (`showTryAgain`, `canRetry`).
- Fonts: Urbanist self-hosted from the original file (Google's latin-ext subset misplaces ā ē ī ū macrons), plus Outfit's ģ for U+0123. Verified in zoomed screenshots at weights 400 and 600.
- Screenshot uploader: paste, drag and drop, help line, status announcements. Markdown links: other sites in a new tab with an icon and `noopener noreferrer`; links into the app in the same tab, no icon.
- Content: links in collaboration-standards (+ q1 as an order question), dna-7-values, superheroes (tip); brief and "builds on" line in wf-2..wf-6; wf-5 screenshots optional with a link-only rubric; `claude-at-uxda` replaced by the draft acknowledge challenge `claude-rules-at-uxda`. **Needs `npm run content:sync`** (not run).
- Checks: `npm run content:validate` ✅ · `npm run check` · `npm run build`. A temporary page in a browser: order list by buttons, keyboard, mouse and touch; paste and drop; link icons; card button; axe (wcag2a/aa/21aa) clean and no overflow at 1280/375/320 in both themes. E2E (`order.spec.ts`, `screenshot-paste.spec.ts`, dashboard/learner updates) written, not run: no test project.

## Testers (`feat/order-question-and-fixes`)

- Migration `20261014100000_testers.sql`: `profiles.is_tester`, `is_tester()` / `my_track_sees()`, `challenges_select` for testers on drafts, `submissions.is_test` (own numbering, 3-attempt check kept for real attempts, owner can read test attempts only while the challenge is a draft), `get_leaderboard` ignores tests, `profile_flag_audit` + `set_user_tester()`, `challenge_feedback`. `docs/schema.sql` and `database.types.ts` updated (types by hand until `db:types` is re-run); `db:check` covers draft visibility per track/category/archived, self-flagging, the audit function, attempt numbering, hiding after publish, the leaderboard and admin-only feedback.
- App: Tester switch on Admin → Users; tester-aware visibility, submit and draft-save (test attempts); "Draft — testing" badge on cards and the challenge page; testing notice; answer key always on test attempts only; "Feedback for Alvis" box; Admin → Content lists feedback (newest first, name, date) and the test attempts; every `submissions` read filtered on `is_test` (guarded by a test).
- Checks: unit tests (visibility, testing state, submit/save as tester and non-tester, reveal rule, feedback and tester-switch actions, the is_test scan); a temporary page in a browser for the new UI (axe clean, no overflow at 1280/375/320, both themes). `e2e/testers.spec.ts` written, not run: no test project, and the migration isn't applied there.

## Challenge page: the question is the focus (`feat/order-question-and-fixes`)

- Brief: leading title heading skipped, collapsed to its first paragraph (toggle) once started (`src/lib/challenges/brief.ts` + tests, `collapsible-brief.tsx`); "Your submission" heading screen-reader only with a stepper; compact restore notice; tighter spacing. A temporary page in a browser: question heading 158px higher, toggle by Enter and Space, notice 20px high, axe clean and no overflow at 1280/375/320 in both themes. E2E (`drafts.spec.ts`, the quiz fixture now has a repeated heading and two paragraphs) updated, not run.

