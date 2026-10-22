# UXDA Learn — project instructions

Internal learning platform for UXDA. Team members sign in with Google (only `ALLOWED_EMAIL_DOMAINS`, currently @uxdesignagency.com),
complete challenges (quizzes, screenshot/Figma submissions), get scored, and appear on a
leaderboard split into groups of tracks (Strategists, Designers, Team — configured in
`src/lib/tracks.ts`). Owner/admin: Alvis ("Vision").

## Stack (fixed — don't swap)
- Next.js (latest stable, App Router) + TypeScript (strict)
- Node 22 everywhere: `.nvmrc` (local, CI), `engines.node` `22.x` (Vercel). Regenerate `package-lock.json` with
  Node 22's npm (10.x), or CI's `npm ci` can disagree with it
- Supabase: Postgres, Auth (Google), Storage. Client via `@supabase/ssr`
- Tailwind + shadcn/ui, lucide-react icons
- Zod for all schemas (content files, form input, eval results)
- Vitest (unit), Playwright (E2E)
- Supabase CLI for migrations and type generation
- Keep it host-portable: no Vercel-only features (Edge Config, KV, etc.)

## Architecture
- `/content` — source of truth for categories and challenges (YAML/Markdown). Synced to DB.
- Supabase — source of truth for users, submissions, evaluations, scores.
- `/scripts` — content validate/sync, eval pull/push, seed admins.
- `/.claude/commands` — `/new-challenge`, `/evaluate`.
- Full DB spec: `docs/schema.sql`. Content format: `docs/content-format.md`.

## Core rules
- **Security first.** RLS on every table. Answer keys and grader notes live in
  `challenge_keys` and must never reach the client. The service role key is server-only
  (never `NEXT_PUBLIC_`, never imported in client components).
- All submission writes go through server actions using the service role after verifying
  the session user. Users can never set their own scores or status.
- Users see categories and challenges whose `audiences` include `all` or their own track.
  `required_for` marks challenges as required per track (validation: only for tracks that can see it).
- Scoring: a challenge's `points` = sum of question points + rubric points. Best published
  attempt per challenge counts. Max 3 attempts. `acknowledge` challenges are 0 points,
  complete instantly and never count on the leaderboard.
- Quiz-only challenges (all questions auto-gradable) publish immediately on submit.
  Anything with screenshots, Figma, reflection or text questions goes:
  `submitted → ai_reviewed (via /evaluate) → published` (admin approves)
  or `→ needs_resubmission`.
- Learning paths (`content/paths/*.yaml`): one card that opens a roadmap of milestone challenges (`path:` on the
  challenge). A path page can have "Before you start" (markdown) and "Before you submit" boxes. Milestones are listed only inside their path; a path counts as one item, done when every milestone is
  done; in a sequential path a milestone unlocks once the previous one has any attempt (checked on the server).
  A path can be required with a due date (`required_for`, `due_at` on the path; admin-owned like status, audited in
  `path_settings_audit`): it counts as ONE required item, done when every milestone has a published score, overdue when
  past due and not every milestone submitted. Milestones are never required on their own.
  Admins can import earlier progress (Admin → Users → a user, or `scripts/import-path-progress.ts`): a normal attempt
  flagged `is_imported`, only on a published path, written by `import_submission()` and audited.
- Testers (`profiles.is_tester`, switched in Admin → Users, audited) can see and take DRAFT challenges their
  track can see (RLS on `challenges`; archived stays hidden). Their attempts on a draft are test attempts
  (`submissions.is_test`): published at once, numbered apart from the 3-attempt limit, shown with the answer key,
  and never counted — not in points, leaderboard, completed, required progress or exports. Every read of
  `submissions` must filter on `is_test` (a test enforces it). After publishing, the tester starts fresh; only
  admins still see the old test attempts.
- Never delete challenges that have submissions — archive them. Content changes bump `version`.
- Content files own content (brief, questions, rubric, points, type, audiences). The admin panel
  owns `status`, `required_for`, `due_at`: files set them only on creation, content:sync never
  overwrites them, and every change is audited (`challenge_settings_audit`). Content with a
  `TODO…` placeholder can't be published.
- Test login (email/password test users) only when `ENABLE_TEST_LOGIN=true` AND
  `NODE_ENV !== 'production'`. Guard it in code and test the guard.

## UI
Clean, calm, professional. Light and dark mode via shadcn. Accent colour `#B5A2FF`.
Mobile-friendly. Every list has an empty state; every async action has loading + error states.

## Working conventions
- Follow BUILD_PLAN.md. Log progress in `PROGRESS.md`, choices in `DECISIONS.md`
  (one line each: decision — reason).
- Run the checks before claiming anything works. Never skip, weaken or delete a test to
  make it pass. Never disable RLS to make something work.
- Commit after each completed phase: `phase N: <summary>`. Push only if `origin` exists.
- Prefer server components; client components only where interaction needs it.
- Database changes: Claude writes the migration; Alvis runs `npm run db:push` and `npm run db:types`
  in the VS Code terminal. Claude doesn't run them.
