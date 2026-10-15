# UXDA Learn

Internal learning platform for the UXDA team. People sign in with their UXDA Google Workspace
account, choose a track (Strategist, Designer, Motion Designer, Account Manager, Marketing Assistant or Management),
complete challenges (quizzes, screenshots, Figma work, reflections, "read and confirm"
acknowledgements), get scored and see themselves on a leaderboard (Strategists / Designers /
Team). Some challenges are required for certain tracks, optionally with a due date. Admins
review submissions (with an AI first pass), track required progress and manage users.

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
npm run seed:domains         # ALLOWED_EMAIL_DOMAINS → allowed_email_domains (who may sign up)
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
| `content:validate` | Validate `/content` (schemas, categories, slugs, ids, points add up, audiences / required_for visible) |
| `content:sync` | Sync `/content` → DB (`-- --dry-run` to preview) |
| `seed:admins` | Allowlist `ADMIN_EMAILS` as admins |
| `seed:domains` | Sync `ALLOWED_EMAIL_DOMAINS` into `allowed_email_domains` (adds and removes) |
| `eval:pull` / `eval:push` | Evaluation batch export / import (see below) |

## Content workflow

Categories live in `content/categories.yaml`, challenges in `content/challenges/<slug>.md`
(YAML frontmatter + markdown brief). Format: [`docs/content-format.md`](docs/content-format.md).

1. Create a challenge by hand or with `/new-challenge <description>` in Claude Code
   (it drafts the file as `status: draft`).
2. `npm run content:validate` — fix every error (points must equal questions + rubric).
3. `npm run content:sync` — creates it in the DB (as a draft).
4. Review it in **/admin → Content → Preview with answers** (questions with correct answers,
   rubric, grader notes), then publish it there.

**Files own the content, the admin panel owns the settings.** Brief, questions, answers, rubric,
points, type and audiences come from the file on every sync. `status`, `required_for` and
`due_at` in a file are only starting values for a *new* challenge; after that they're changed in
**/admin → Content** (instant save, change history per challenge: who, what, old → new, when)
and `content:sync` never overwrites them — it just lists where a file disagrees. A challenge
containing a `TODO…` placeholder (e.g. `TODO_FIGMA_URL`) can't be published. Details:
[`docs/content-format.md`](docs/content-format.md#who-owns-what).

Targeting: `audiences: all` or a list of tracks (categories and challenges), `required_for` the
same shape (omitted = optional), `due_at` for a deadline, and `type: acknowledge` for briefs
people only need to confirm they've read (0 points, never on the leaderboard). Tracks and the
leaderboard groups are configured in [`src/lib/tracks.ts`](src/lib/tracks.ts).

Rules the sync enforces:
- Answers and `grader_notes` go only to the private `challenge_keys` table — never to clients.
- Changing a challenge's content or answer key bumps its `version`; `status`, `required_for` and
  `due_at` changes don't (nor does a stored hash going stale after a format migration).
- `status`, `required_for` and `due_at` are written only when a challenge is created.
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

## Required progress and acknowledgements

- **/admin → Required progress**: per person, every required challenge as done / awaiting
  review / not done / overdue, filterable by track, with **Export CSV** (one row per person and
  required challenge). "Resubmission requested" counts as not done (and can become overdue).
- **/admin → Acknowledgements**: per acknowledge challenge, who confirmed (and when) and who
  hasn't yet.

## Testing

- **Unit** (`npm run test`, part of `check`): content validation (audiences, required_for,
  acknowledge, TODO placeholders), sync planning (incl. file vs admin-owned settings), admin
  settings validation and audit formatting, grading, attempt history grouping and
  required-progress rules, leaderboard groups,
  the acknowledge action guard, submission input validation, eval results validation, CSV
  escaping, auth guards, and WCAG AA contrast of the light/dark theme tokens.
- **Integration** and **E2E** write real data, so they use a **separate Supabase project**:
  1. Create a second Supabase project (Auth → email provider on, the default; Google isn't needed).
  2. Set `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`,
     `TEST_SUPABASE_PROJECT_REF` (and optionally `TEST_SUPABASE_ACCESS_TOKEN`).
  3. `npm run db:push -- --test-project`, `npm run seed:domains -- --test-project`,
     `npm run content:sync -- --test-project` (the admin spec expects real content), then
     `npm run db:check -- --test-project`.

  A local stack works too: `npx supabase start` (Docker), then point `TEST_SUPABASE_URL` /
  `_ANON_KEY` / `_SERVICE_ROLE_KEY` at the values from `npx supabase status`; migrations apply
  on start, so only `seed:domains` and `content:sync` (with `--test-project`) are needed.
  4. `npm run test:integration` and `npm run test:e2e`.

  Without these vars both commands skip and pass. Using the main project's URL or ref is refused.
  E2E starts its own `next dev` on port 3100 pointed at the test project, installs an
  `[E2E] Test challenges` fixture category, and removes it and all test-user data afterwards.

## CI

`.github/workflows/ci.yml` runs `npm ci`, `npm run check` and `npm run build` on every push and
pull request. It uses placeholder `NEXT_PUBLIC_SUPABASE_*` values and no secrets; integration
and E2E tests aren't run there (they need the test Supabase project).

## Security model (summary)

- RLS on every table plus explicit grants; `challenge_keys`, `admin_allowlist` and `allowed_email_domains` have no client
  access at all. `acknowledgements` are readable by their owner and admins, writable only by the server. `challenge_settings_audit` is readable by admins only and written only through `set_challenge_setting()` (service role). Storage bucket `submissions` is private; users can write/read only their own folder.
- All writes (submissions, acknowledgements, reviews, track and challenge-setting changes) go through server actions that verify the
  session and use the service role; users can never set scores or status. The only client-side
  write is a user's own `show_on_leaderboard`.
- Sign-in is limited to the `ALLOWED_EMAIL_DOMAINS` domains (currently uxdesignagency.com): the
  DB trigger checks the `allowed_email_domains` table (synced by `seed:domains`), and the auth
  callback re-checks against the env var.
- The service-role key is server-only (`server-only` import guard); never use `NEXT_PUBLIC_` for it.

## Project layout

```
content/                 challenges + categories (source of truth for content)
docs/                    schema spec, content format, seed briefs
e2e/                     Playwright specs + fixtures
scripts/                 db, content and eval CLIs (scripts/lib/eval = pipeline logic)
src/app/(app)/           learner pages (home, categories, challenges, submissions, profile, leaderboard)
src/app/(admin)/admin/   admin pages (review, users, required progress, acknowledgements, content settings + preview), actions, CSV exports
src/lib/                 auth, supabase clients, content schemas, grading/rules, data access
supabase/migrations/     database migrations
tests/                   fixtures, integration tests, shared test support
```
