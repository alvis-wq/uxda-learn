# Progress

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

## Known issues
- `supabase link` fails with `LinkAuthTokenError`: the access token is rejected (403) on
  project config endpoints (`/config/database/postgres`, `/config/auth`, `/postgrest`).
  Project read, `api-keys`, `types/typescript` and `database/query` work, so DB work uses the
  Management API fallback from BUILD_PLAN Phase 1. Direct Postgres (port 5432) is not
  reachable from the cloud session either. Fix: use a personal access token with full
  project access (Owner/Admin) if CLI `link`/`db push` are wanted.
