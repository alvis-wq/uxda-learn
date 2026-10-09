# UXDA Learn

Internal learning platform for the UXDA team. People sign in with their @theuxda.com Google
account, choose a track (Strategist or Designer), complete challenges (quizzes, screenshots,
Figma work, reflections), get scored and see themselves on a per-track leaderboard. Admins
review submissions (with an AI first pass) and manage users.

- **Stack:** Next.js 16 (App Router, TypeScript strict) · Supabase (Postgres, Auth, Storage) via
  `@supabase/ssr` · Tailwind v4 + shadcn/ui · Zod · Vitest · Playwright.
- **Project rules:** [`CLAUDE.md`](CLAUDE.md) · build history: [`PROGRESS.md`](PROGRESS.md) ·
  choices: [`DECISIONS.md`](DECISIONS.md) · deploying: [`DEPLOY.md`](DEPLOY.md).

## Setup

One-time account setup (Supabase project, Google OAuth client) is in [`SETUP.md`](SETUP.md).

```bash
npm install
cp .env.example .env.local   # fill in the main project values (see comments in the file)
npm run db:push              # apply supabase/migrations
npm run db:types             # regenerate src/lib/database.types.ts
npm run seed:admins          # ADMIN_EMAILS → admin_allowlist (+ promote existing profiles)
npm run content:sync         # /content → database
npm run db:check             # tables, RLS, private-table and signup-domain checks
npm run dev                  # http://localhost:3000
```

With `ENABLE_TEST_LOGIN=true` (development only) the login page also offers test users
(strategist, designer, admin). It is disabled whenever `NODE_ENV=production`.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js dev server / production build / production server |
| `check` | Typecheck + lint + unit tests — run before every commit |
| `test` | Unit tests (Vitest) |
| `test:integration` | DB integration tests (eval pipeline) against the **test** project; skips if not configured |
| `test:e2e` | Playwright E2E + a11y (axe) + 375px checks against the **test** project; skips if not configured |
| `db:push` | Apply pending migrations via the Supabase Management API (`-- --test-project` for the test project) |
| `db:types` | Regenerate `src/lib/database.types.ts` — run after every migration |
| `db:check` | Verify tables, RLS, that clients can't read `challenge_keys`, and the signup domain guard |
| `content:validate` | Validate `/content` (schemas, categories, slugs, ids, points add up) |
| `content:sync` | Sync `/content` → DB (`-- --dry-run` to preview) |
| `seed:admins` | Allowlist `ADMIN_EMAILS` as admins |
| `eval:pull` / `eval:push` | Evaluation batch export / import (see below) |

## Content workflow

Categories live in `content/categories.yaml`, challenges in `content/challenges/<slug>.md`
(YAML frontmatter + markdown brief). Format: [`docs/content-format.md`](docs/content-format.md).

1. Create a challenge by hand or with `/new-challenge <description>` in Claude Code
   (it drafts the file as `status: draft`).
2. `npm run content:validate` — fix every error (points must equal questions + rubric).
3. Review, set `status: published`, then `npm run content:sync`.

Rules the sync enforces:
- Answers and `grader_notes` go only to the private `challenge_keys` table — never to clients.
- Changing a challenge's content or answer key bumps its `version`; status changes don't.
- Removing a file **archives** the challenge (or category); nothing is ever deleted.
- Running sync twice in a row reports `0 change(s)`.

## Evaluation workflow

Quiz-only challenges are graded and published the moment someone submits. Everything else
(screenshots, Figma, text answers, reflections) goes
`submitted → ai_reviewed → published` (or `needs_resubmission`):

1. In Claude Code run `/evaluate` (see [`.claude/commands/evaluate.md`](.claude/commands/evaluate.md)). It:
   - runs `npm run eval:pull` → `.eval/<batch_id>/manifest.json` + downloaded screenshots
     (`.eval/` is git-ignored — it contains personal submissions);
   - scores each item in `review_items` against the rubric levels and grader notes, citing evidence;
   - writes `.eval/<batch_id>/results.json` and runs `npm run eval:push -- <batch_id>`.
2. `eval:push` validates the whole file first (ids, max points, totals, evidence, flags) and
   writes nothing if anything is wrong. It's idempotent, and it never overrides a submission an
   admin already reviewed.
3. In **/admin → Review queue** (AI-reviewed first, low confidence flagged), open each
   submission, adjust score/feedback and **Approve & publish** or **Request resubmission**.
   Only then do learners see their score and feedback.

## Testing

- **Unit** (`npm run test`, part of `check`): content validation, grading, attempt rules,
  submission input validation, eval results validation, CSV escaping, auth guards.
- **Integration** and **E2E** write real data, so they use a **separate Supabase project**:
  1. Create a second Supabase project (Auth → email provider on, the default; Google isn't needed).
  2. Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`,
     `TEST_SUPABASE_PROJECT_REF` (and optionally `TEST_SUPABASE_ACCESS_TOKEN`).
  3. `npm run db:push -- --test-project` then `npm run db:check -- --test-project`.
  4. `npm run test:integration` and `npm run test:e2e`.

  Without these vars both commands skip and pass. Using the main project's URL or ref is refused.
  E2E starts its own `next dev` on port 3100 pointed at the test project, installs an
  `[E2E] Test challenges` fixture category, and removes it and all test-user data afterwards.

## CI

`.github/workflows/ci.yml` runs `npm ci`, `npm run check` and `npm run build` on every push and
pull request. It uses placeholder `NEXT_PUBLIC_SUPABASE_*` values and no secrets; integration
and E2E tests aren't run there (they need the test Supabase project).

## Security model (summary)

- RLS on every table plus explicit grants; `challenge_keys` and `admin_allowlist` have no client
  access at all. Storage bucket `submissions` is private; users can write/read only their own folder.
- All writes (submissions, reviews, track changes) go through server actions that verify the
  session and use the service role; users can never set scores or status. The only client-side
  write is a user's own `show_on_leaderboard`.
- Sign-in is limited to @theuxda.com by a DB trigger (and re-checked in the auth callback).
- The service-role key is server-only (`server-only` import guard); never use `NEXT_PUBLIC_` for it.

## Project layout

```
content/                 challenges + categories (source of truth for content)
docs/                    schema spec, content format, seed briefs
e2e/                     Playwright specs + fixtures
scripts/                 db, content and eval CLIs (scripts/lib/eval = pipeline logic)
src/app/(app)/           learner pages (home, categories, challenges, submissions, profile, leaderboard)
src/app/(admin)/admin/   admin pages, actions and CSV export
src/lib/                 auth, supabase clients, content schemas, grading/rules, data access
supabase/migrations/     database migrations
tests/                   fixtures, integration tests, shared test support
```
