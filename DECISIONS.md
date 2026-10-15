# Decisions

- Scaffolded create-next-app in a scratch dir and copied files in — create-next-app refuses non-empty folders; this guarantees nothing existing is overwritten.
- Next.js `cacheComponents` / `partialPrefetching` turned off — every page is per-user and auth-gated, so a static shell buys little and session reads would need Suspense everywhere.
- shadcn/ui initialised by hand (components.json + copied components) — `ui.shadcn.com` is blocked by the session's network policy; components are the standard new-york source using the `radix-ui` package.
- Accent `#B5A2FF` used as `--primary` with dark foreground text — light lavender needs dark text for WCAG contrast.
- `@types/node` pinned to ^22 — Vitest 5 peer-requires >=22 and the runtime is Node 22.
- Scripts load `.env.local` via `process.loadEnvFile` — no dotenv dependency; existing env vars win (cloud sessions).
- `typecheck` runs `next typegen` first — Next 16 route/layout prop types are generated globals.
- Vitest config is `.mts` — Vitest 5 warns on ESM config loaded as CJS.
- E2E runs against `next dev` — test login is disabled whenever `NODE_ENV=production`, which `next start` sets.
- Playwright uses `/opt/pw-browsers/chromium` when present (override `PW_CHROMIUM_PATH`) — avoids browser downloads in cloud sessions.
- Proxy (formerly middleware) lives in `src/proxy.ts` — Next 16 renamed the convention.
- Migrations applied via Management API `database/query` (`npm run db:push`) — `supabase link`/`db push` fail: token lacks config-endpoint privileges and Postgres:5432 is unreachable from the session.
- Applied migrations tracked in `supabase_migrations.schema_migrations` — same table the CLI uses, so switching back to `supabase db push` later just works.
- Migration adds explicit GRANT/REVOKE on top of schema.sql — RLS alone shouldn't be the only layer, and it removes dependence on the project's default Data API grants.
- `get_leaderboard`, `is_admin` execute revoked from anon/public — every page requires sign-in; no reason to expose them.
- `check-db` uses a real temp user and sentinel rows — "0 rows from an empty table" would prove nothing.
- Added `npm run db:check` script for `scripts/check-db.ts` — consistent with other db:* scripts.
- Scripts use their own service-role client (`scripts/lib/supabase.ts`) — app-side admin client imports `server-only`, which throws outside the React server bundle.
- Content schemas are strict (unknown keys rejected) — catches typos like `point:` that would otherwise silently drop data.
- `content_hash` covers public fields only; key changes detected by comparing `challenge_keys` — users can read `content_hash`, and a hash including answers could be brute-forced for small quizzes.
- Status excluded from the hash — publishing/archiving isn't a content change, so it doesn't bump `version`.
- `status` defaults to `draft` when omitted — safer than the DB default `published`.
- Added optional `summary` and `due_at` frontmatter (DB has the columns); summary falls back to the brief's first paragraph.
- Multi-answer keys stored sorted — stable comparison and grading.
- gray-matter parses with the `yaml` package — one YAML parser for categories and frontmatter.
- Sync uses sequential supabase-js writes (not one transaction) — idempotent: a partial run is completed by the next run.
- New ai-workflow quizzes are `draft` — Alvis reviews new content before publishing (same rule as seed challenges and /new-challenge).
- Quiz single-answer positions varied — all-"b" answers were guessable.
- Test login uses a service-role magic-link token verified server-side, not `TEST_USER_PASSWORD` — test users live in the real project; a known password (esp. for test-admin) would let anyone with the public anon key sign in, bypassing the app's production guard. `TEST_USER_PASSWORD` is now unused.
- Test-login guard checked in both the login page (UI) and the server action — the action is the real gate; unit-tested with NODE_ENV=production.
- Proxy uses `getClaims()`; pages use `getUser()` — cheap check per request, authoritative check where data is read.
- `/auth/error` is public alongside `/login` and `/auth/callback` — users rejected by the domain trigger have no session and must be able to see why.
- `next` redirect param restricted to same-origin paths (`safeNext`) — prevents open redirects through login.
- Callback re-checks the email domain after code exchange — defence in depth on top of the DB trigger.
- Onboarding writes via service role with `track IS NULL` in the WHERE clause — atomic "only once" rule, no client update grant on `track`.
- Page titles inside cards are `<h1>`s — shadcn CardTitle is a div; headings needed for a11y and role-based tests.
- E2E resets the test strategist's track via service role before running — makes the onboarding test repeatable.
- `TEST_USER_PASSWORD` removed from `.env.example` and SETUP.md — unused since test login switched to admin-generated one-time tokens.
- shadcn CLI used again for new components; its stray `cn` npm package removed and imports pointed at `@/lib/utils` — unknown third-party dependency.
- Markdown via `react-markdown` + `remark-gfm` + Tailwind typography — conventional, no raw HTML rendering.
- Multi-select questions are all-or-nothing — no partial-credit rule exists in the docs; simplest unambiguous grading.
- Learners see per-question ✓/✗ after every attempt, but the right answers only once they have full marks on the challenge or have used all 3 attempts (replaces "only the total", 2026-10-14) — a wrong/right mark alone gives away little; the key itself would let them copy it into the next attempt. The check runs on the server (`answerReveal`) and the key is not even put in the page before then.
- AI score/feedback hidden in the UI until published/needs_resubmission — admin approval is the gate; the row itself is the user's own (RLS) so this is presentation, not a secret.
- New attempt allowed after `needs_resubmission` or a non-perfect published score, up to 3 — "best published attempt counts" implies retakes; blocked while awaiting review.
- Screenshot paths are re-validated and checked for existence server-side — the client chooses paths, so it must not be trusted.
- Orphaned uploads (removed before submit) stay in Storage — no delete policy for users; harmless and cheap. Cleanup can be a later admin script.
- Admins can preview draft challenges but can't submit to them — useful for review, no polluted data.
- E2E runs against the real project with an isolated fixture category and full cleanup of test-user data — only one Supabase project exists; content:sync would archive any leftover fixture.
- Leaderboard tabs are `?track=` links rendered on the server — no client state, shareable URLs, works without JS.
- Leaderboard visibility updated with the user's RLS client, not the service role — the DB already grants exactly that column; least privilege.
- Ties share a rank (1, 2, 2, 4) — standard competition ranking, matches the SQL order (score, then completed).
- Dashboard "pending reviews" counts submissions in `submitted` or `ai_reviewed` — both are "Awaiting review" to the learner.
- Admin lives in its own `(admin)` route group, not under `(app)` — `(app)/loading.tsx` streams the response, so `forbidden()` there would render the 403 UI with a 200 status.
- `forbidden()` via `experimental.authInterrupts` — gives a real 403 + dedicated page; the flag is documented and stable enough for one call site.
- Admin reads use the admin's own RLS client; only writes use the service role — RLS stays a second check even inside /admin.
- Every admin action re-checks `is_admin` from the DB — UI hiding and layouts aren't authorization.
- Review is a compare-and-set (`WHERE status IN (submitted, ai_reviewed)`) — two admins (or a double click) can't double-review.
- Final score in half-point steps, 0..max_score — rubric levels allow "in between" scores; finer precision adds nothing.
- Requesting resubmission requires feedback — the learner must know what to change.
- Admins can't remove their own admin flag — prevents locking the last admin out; another admin can.
- Toggling admin doesn't touch `admin_allowlist` — the allowlist only seeds admins at signup / `seed:admins`.
- CSV cells starting with = + - @ are prefixed with ' (numbers excepted) — spreadsheet formula injection via user-controlled names.
- CSV has one row per user with per-challenge best scores (non-draft challenges) — the most useful single export; totals match the leaderboard rule.
- Screenshot uploader disabled until hydrated — a file chosen before React attaches `onChange` is silently lost.
- E2E specs each wipe test-user data in `beforeAll` — specs run in any order; serial within a file.
- Eval logic lives in `scripts/lib/eval/` with thin CLI wrappers — testable without spawning processes.
- Text questions are scored as `criteria` entries (id = question id) — results.json has no other place for them, and it keeps `final_score = auto_score + total` true for every challenge.
- Manifest lists `review_items` explicitly — the evaluator gets the exact ids and max points to fill in instead of deriving them.
- `eval:push` is all-or-nothing on validation — a half-applied batch is harder to reason about than a rejected file.
- Push never modifies submissions an admin already published or sent back, and older batches can't overwrite newer ones — AI review must never undo a human decision.
- Scores in half points, evidence required, `figma_inaccessible` ⇒ low confidence — enforce the calibration rules in evaluate.md mechanically.
- Integration tests use a separate Vitest config (`npm run test:integration`) — `npm run check` stays fast and offline-safe.
- E2E/integration tests target a separate project via `TEST_SUPABASE_*`, skip when unset, and refuse the main project by URL or ref — tests create users, submissions and uploads; that must never happen in production data.
- Playwright overrides the dev server's Supabase env and never reuses an existing server — a reused server could be talking to the main project.
- `--test-project` flag on scripts maps `TEST_SUPABASE_*` onto the normal vars — one code path, and the test project is set up with the same migrations.
- Added `@axe-core/playwright` (dev only) — "basic a11y" verified by a tool, in light and dark mode, instead of by eye.
- Responsive check is automated (no horizontal overflow at 375px) plus a visual screenshot review — overflow is the common mobile failure; tables hide secondary columns on small screens.
- DEPLOY.md instead of a preview deploy — no Vercel CLI linked; the app is host-agnostic.
- CI runs check + build with placeholder `NEXT_PUBLIC_SUPABASE_*` and no secrets — the build never contacts Supabase (verified with an empty env), so real keys would only add risk. E2E/integration stay out of CI until a test project + secrets are set up.
- Allowed sign-in domains in a table (`allowed_email_domains`) synced from `ALLOWED_EMAIL_DOMAINS` by `seed:domains` — migrations can't read env vars, and the trigger needs a DB-side source; sync removes stale domains so the env var stays the single source of truth.
- Empty `allowed_email_domains` rejects every sign-up, and a missing `ALLOWED_EMAIL_DOMAINS` makes the app refuse sign-in — fail closed rather than fall back to a hardcoded domain.
- Google `hd` is the domain when one is configured, `*` (any Workspace account) when several — `hd` takes a single value and is only a picker hint.
- Test users live on the first configured domain — they must pass the same trigger as real users.
- Tracks + leaderboard groups live in `src/lib/tracks.ts`; `get_leaderboard` takes `track[]` — one place to regroup tracks without a migration; every track is in exactly one group (unit-tested).
- `audiences audience[]` with a `valid_audiences` check (`{all}` or distinct tracks) instead of a join table — small fixed set, read on every page, and the check keeps `all` from being mixed with tracks.
- New enum values in their own migration — Postgres can't use an enum value in the transaction that adds it, and db:push runs each migration in one transaction.
- A challenge may narrow its category's audiences but never widen them (validation error) — a wider challenge audience could never be seen anyway.
- `required_for: all` means every track — literal reading; it fails validation unless everyone can see the challenge, which catches "required for all" on a track-only category.
- Required states: done / pending (awaiting review) / missing (not started or resubmission requested) / overdue (missing past due_at) — per Alvis: resubmission needs learner action, so it can become overdue; awaiting review can't.
- `required_for` and `status` are excluded from `content_hash` — (un)requiring a challenge isn't a content change and mustn't bump `version`.
- content:sync re-hashes the DB row's public fields before calling something a content change — a stored hash going stale after a format migration (audience → audiences) refreshes the hash without bumping every challenge's version.
- `due_at` normalised to ISO `Z` before hashing — Postgres returns `+00:00`, which would look like a change.
- Acknowledgements in their own table (not submissions) — they can never leak into scores, the leaderboard, "completed" counts, the review queue or eval:pull.
- One acknowledgement per user and challenge (records the version confirmed); editing the brief doesn't ask for re-confirmation — re-confirm on new versions can be added later using the stored version.
- Acknowledge challenges: points 0 (DB check ties `type = acknowledge` to `points = 0`), difficulty not needed (stored as 1, hidden in the UI).
- Old `audience:` key rejected with a pointed message — silent fallback would hide stale content.
- Admin required-progress/acknowledgement data built by pure functions (`src/lib/admin/required-progress.ts`) shared by the page and CSV — one rule set, unit-tested without a DB.
- Type scale +2px via Tailwind theme sizes; new `text-meta` (14px, the old text-sm) for meta info, table headers and captions; badges stay text-xs — one change in globals.css instead of editing every class; `tailwind-merge` taught that `text-meta` is a size.
- Softer palette as hex tokens, contrast-checked by a unit test (`theme-contrast.test.ts`) — axe runs only in E2E; the token test runs in every `check`.
- Destructive badges/buttons use a `--destructive-foreground` token instead of `text-white` on 60% red in dark mode — the old dark combination was below 4.5:1 with overdue badges now common.
- Markdown briefs use `prose-lg` — the typography plugin's base size is 16px; prose-lg is the +2px step.
- Scripts that use Node's fetch need `NODE_USE_ENV_PROXY=1` in cloud sessions — Node's built-in fetch ignores HTTPS_PROXY.
- E2E/integration verified on a local Supabase stack (`supabase start` in Docker) — no test project exists yet, and test login against the main project would recreate test users there.
- Files own content, the admin panel owns status / required_for / due_at (file values = initial values only) — operational settings change week to week and shouldn't need a commit + sync; one owner per field avoids sync silently reverting admin changes.
- content:sync reports file-vs-DB setting drift but never writes it — makes the "DB wins" rule visible instead of surprising.
- `due_at` removed from `content_hash` — it's an admin setting now; changing a deadline isn't a content change and mustn't bump the version.
- Settings change through one SQL function (`set_challenge_setting`, service role only) that writes value + audit row in one transaction — an audit log that can't miss a change or record one that didn't happen; no-ops write nothing.
- Audit as rows per field with jsonb old/new (not a generic trigger) — three known fields, readable history, and `source` distinguishes admin edits from sync archiving.
- Visibility and placeholder rules validated in the server action (pure, unit-tested `settingChangeError`), not in SQL — the same rule code as content:validate; DB checks still guard the shape.
- TODO placeholders = upper-case `TODO` or `TODO_*`, checked in public content and grader notes — catches TODO_FIGMA_URL-style markers without flagging prose like "todo list".
- Required-for picker shows every track, disabling the ones that can't see the challenge — explains why a track can't be picked instead of hiding it.
- Due date edited in the admin's browser time zone and saved on blur — datetime-local fires on every keystroke; local time is what the admin means. Rendered after hydration to avoid server/client time-zone mismatch.
- Admin preview is a separate admin-only page rendering the key server-side — answer keys never enter the learner challenge page or any client bundle.
- Profile headline = best published attempt (ties: first to reach it, like the leaderboard); other published attempts are "Earlier attempt" if before it, else "Not counted" — "earlier" would be wrong for a later, lower score.
- Collapsible attempts via native `<details>` — no client JS needed on the profile.
- New `warning` colour token (#a14a00 / #f0b44c) plus an icon for scores < 50% — AA on every surface in both themes (unit-tested), and not colour-only.
- The X renders on pure black and the canvas is `mix-blend-mode: screen`-ed onto #17181C instead of passing the stage colour as `background` — glass-x's post-processing washes any non-black clear colour out to grey once the reveal ends (reproduced on the untouched original, real GPU), black is stable and exactly as designed.
- Soft radial mask on the glass canvas — the wide bloom glow otherwise shows a hard square edge where the canvas ends during the burst.
- Intro plays the reveal at 2.5× (`speed` option, default 1) instead of cutting it at 2 s — one clock drives everything, so the whole designed sequence still finishes inside the budget; DEFAULTS are otherwise untouched.
- Intro state is a session cookie (`uxda_intro`: pending → seen), queued server-side on sign-in — the server renders the overlay in the first HTML (no flash of the app), it's "once per browser session" literally, and sessionStorage can't do either.
- Intro overlay also fades out via CSS at 1.7 s — if JS never runs it still clears itself and can't trap the app.
- Reduced motion shows the static PNG and never loads three (no intro, no fade) — "static settled X" with zero WebGL cost.
- `.glb` is exempt from the auth proxy matcher — signed-out visitors need the model on /login, and the proxy was answering with the login HTML.
- Default E2E runs with `reducedMotion: "reduce"` — skips the intro and animations everywhere; `glass-x.spec.ts` opts back in.
- ESLint ignores `design-assets/` — reference-only handoff files, not app code.
- Urbanist as a variable font (no weight list) — one file covers 400/500/600 and the bold markdown uses; latin-ext added for names with diacritics.
- Dark surfaces are neutral greys stepping up from #101010 (card → popover → muted → secondary) instead of the old cool tint — layering stays readable on a near-black page without a colour cast; accent keeps its violet tint.
- "Learn" is hidden below `sm` and aria-hidden at all sizes — the logo's label already says "UXDA Learn", and the admin header only fits 375px with the logo alone.
- Admin track filter keeps `rounded-3xl` on mobile, pill from `sm` — a fully rounded container looks wrong when its pills wrap to two rows.
- SpecularButton's cleanup only calls `loseContext()` once the canvas is detached — under React StrictMode (`next dev`, so also Playwright) the effect re-runs on the same canvas and the published cleanup kills the context for good, leaving a white box; production was unaffected.
- SpecularButton keeps its render-time `settingsRef.current = settings` behind a targeted `eslint-disable react-hooks/refs` — it's the published logic, and rewriting it would drift from React Bits for no gain.
- Fallback border only when `supportsWebGL2()` is false — with WebGL the shader draws the edge, and an always-on border would double it.
- RubberNav paints the thumb's clip-path/opacity straight from the motion values' change events instead of `useTransform` — a derived style isn't refreshed after `jump()`, which left the thumb unclipped on any direct load except the first item.
- Nav thumb is derived from the pathname, not optimistic on click — the "active" item can never disagree with the page (redirects, 403s), at the cost of the thumb moving when navigation commits (loading.tsx makes that near-instant).
- Page entry never animates the initial hard load — that content is already on screen, and hiding then re-showing it would flash; it animates route changes only.
- Page entry watches for new content under the template and skips `aria-busy` roots — pages stream in behind loading.tsx skeletons, so a bare template would animate the skeleton and then pop the real page in.
- Page entry animates the page root's children (lists flattened to rows) and only those on screen — "blocks" is what a reader sees appear; below-the-fold blocks need no animation and animating dozens of blurred rows is wasted work.
- Admin template lives in `(admin)/admin/` (inside the admin layout) — the admin sub-navigation is navigation and must not animate.
- Dark `--nav-text-active` is pure #ffffff as specified, so the "no pure white in dark mode" test has one explicit, asserted exception for that token rather than being loosened.
- Page entry mutates the DOM only after a client-side route change (`nextEntryState`): anything touched before hydration finishes — including content streamed in behind loading.tsx on a hard load — is a hydration mismatch, and the server must always render the visible final state.
- The X zooms by moving the camera (`setZoom`, distance / zoom) in a big square canvas (`min(140vmin, 1100px)`) instead of scaling the element — it stays sharp, and the canvas is large enough that the 1.6× tips stay inside the soft mask.
- The login canvas box is centred with negative margins, never a transform — a transformed ancestor isolates the canvas's `mix-blend-mode: screen` and turns the stage black around the X.
- Login sequence state is a session cookie read by the server page (`initial: play | done`) — a returning visitor's first HTML is already the end state, so nothing flashes either way; client storage can't do that.
- The card is hidden with opacity/pointer-events (not `visibility`/`display`) and its buttons get `tabindex=-1` until it is visible — screen readers can still reach it, keyboard users can't tab into something invisible; before hydration (and without JS) it stays in the normal Tab order.
- The sequence's clock starts when the X is ready and gives up after ~1 s — a slow model must never delay signing in, and a late model is discarded rather than started mid-card.
- The post-login loader waits for `load` and for `aria-busy` skeletons to leave `#main` — "page ready" means the content the user came for, not just hydration; no maximum, only a CSS backstop (30 s) for pages whose scripts never run, since an SSR'd full-screen overlay with dead JS would otherwise trap the app.
- Glow strength is bounded by a unit test of the composited glass card (muted text ≥ 4.5:1 at the glow's centre) — measured pixels at five sample points missed the brightest spot, the modelled worst case didn't.
- Step validity reuses the server's `submissionInputSchema` (issues mapped to steps) — one rule set, so Continue can never allow what the server would reject.
- Step state lives in the form above the Stepper, and uploads are a hook there — the Stepper unmounts every non-current step (and mounts a second copy of the one being left for ~200 ms), so a component holding its own upload state would drop or duplicate uploads.
- Forward jumps are clamped to the first invalid step (`clampStep`), on top of the Stepper's `linear` mode — going back to change an answer can't leave a path past a now-invalid step to Review.
- The brief is step 1 only for mixed challenges that show a stepper; on the page otherwise (preview, no attempts left, single-step, acknowledge), so it is never hidden.
- A challenge with a single input (one question, or only a reflection) keeps the plain form — a Brief/Input/Review stepper around one field is more ceremony than help.
- Draft restore remounts the form once after hydration instead of reading sessionStorage during the first render — otherwise server and client HTML differ; the pre-hydration instance doesn't write, so it can't wipe the draft.
- Drafts skip screenshots — their previews are object URLs that don't survive a refresh; the uploaded files stay in the learner's own folder and are simply re-added.
- Removed `aria-live` from the Stepper viewport — it would re-announce the form's fields on every change; focus on the step heading announces the new step instead.
- Review's step button is named "Review & submit", so E2E selects the real button with `{ name: "Submit", exact: true }`.
- Skeleton sweep is one `@property`-animated custom property on `:root` read by viewport-fixed gradients — per-element animations start whenever each skeleton mounts and drift apart, and a per-element ::after sweep can't cross several skeletons as one band; it only runs while a skeleton exists (`:root:has(...)`), so idle pages pay nothing.
- The loader shows after every new sign-in, not once per browser session — a sign-in always sets `pending` and sign-out clears the cookie; "seen" only stops reloads and navigation within the same sign-in.
- The loader has no glow at all, not a smaller one — it is a plain #101010 stage; only the login card keeps the (now half-size) glow it refracts.
- Card images are display-only and outside `content_hash` — swapping artwork must not bump a challenge's version (versions mean "the content changed"); sync writes a changed image as its own update.
- Image values are bare file names in `public/challenges/` (no folders), checked by Zod, a DB check constraint and a file-exists validation — no path traversal, and a typo fails `content:validate` instead of shipping a broken image.
- Lavender text uses its own token: `#B5A2FF` on dark, a darker violet (`--brand-text`) on light — the brand lavender is 2.3:1 on white; the CTA pill keeps the brand fill with dark text.
- The whole card is one link (the title, stretched), with the CTA aria-hidden — one tab stop per card and the accessible name stays the challenge title.
- The aurora is behind the hero with the bright band below the stats and the hero sized to the aurora (not the reverse), so no text sits on the brightest part; verified by sampling rendered pixels, since axe can't see through a canvas.
- Aurora mounts after hydration: the theme is only known on the client, and a theme-dependent first render would not match the server HTML.
- Count-up: the server renders the final number (correct without JS), the animation is set before first paint, and it plays once per browser session (module state) — a brief SSR-final → 0 flip on a hard load is the cost of keeping the HTML correct.
- Sticky-header state uses an IntersectionObserver sentinel, not a scroll listener, and the server always renders the "top" state — nothing to mismatch on hydration.
- A lone last card spans the full row rather than leaving a half-empty row.
- "Middle line of the aurora" = the middle of its glow (0.115 of the box above its bottom edge), not the box's centre — the box's upper half is empty with `direction="bottom"`, so the literal reading shows no aurora at all. One constant (`GLOW_MIDLINE`) changes it.
- A scrim behind bare text (page colour at 85%, invisible at rest), not a dimmer aurora — dimming it enough for muted text (luminance <= 0.043) would leave a ~7%-opacity ghost; the scrim keeps the glow vivid wherever there is no text.
- The aurora is portalled to `<body>` — `position: fixed` and a negative z-index don't survive an ancestor with a transform (the page-entry wrapper), so they can't live inside the page tree.
- The app ignores the system colour scheme (`enableSystem={false}`): the only inputs are the saved toggle choice and the dark default.
- Chips use the card surface (opaque) and the label the full foreground colour instead of a scrim — no shadow anywhere near them; the remaining risk is only text passing through the glow mid-scroll, which no padding can remove.
- Contrast is held at the resting position only (scrolled to the end, text above the glow), with no scrim or shadow anywhere — the glow is a decoration that text may pass over while scrolling; the bottom padding equals the glow's measured reach (`box x (0.48 - 0.115) + 1rem`) so it stays correct at any viewport height, and a unit test pins it to the measured reach.
- The aurora's size is one formula (`aurora/geometry.ts`) used by the component, the page padding and the tests — halving the glow is one change, and the padding follows it.
- Header = three-column grid with equal `minmax(0,1fr)` outer columns at every width — the only way to put the nav at the true viewport centre; the cost is that the nav needs room on both sides, so labels moved from md to lg and phones under ~400px get a tighter nav.
- The login sequence no longer remembers that it played (supersedes the session-cookie decision above): a stored "seen" flag meant a reload or a sign-out landed on a bare card; it plays on every load, and since nothing is stored the server always renders the same first HTML.
- The sound is tied to the sequence, not to the page: it starts at `onReady` (when the X is), is turned on mid-sequence from the sequence's position, and a skip fades it — so audio and picture can't drift apart; with no sequence (reduced motion) the toggle alone decides.
- Default off and silent on failure: browsers block unprompted audio, so the default is an opt-in toggle; a blocked or failed `play()` is swallowed — a missing sound must never look like an error.
- A hand-rolled linear fade instead of `motion`'s `animate`: it ran in the zoom but never ticked for the volume in the toggle path; the explicit ramp is time-based (a stalled frame jumps to the right volume), unit-tested (`fadeVolume`) and measured.
- The toggle swallows only Enter/Space/pointer events: using it must not skip the sequence, but any other key still does ("any key skips" stays true).

- Drafts are written with the learner's own session under RLS, not the service role — an exception to "all submission writes use the service role": a draft holds nothing scored or trusted, and own-row policies (with no admin clause) make "users read and write only their own rows; admins can't edit them" a database rule; the action still validates and checks visibility/attempts first.
- Drafts are validated by a partial twin of the submission schema (`draftInputSchema`), not the submission schema itself: that one demands finished answers, which a draft by definition isn't; what it keeps is everything about *what may be stored* (known ids and options, own screenshot paths, bounded text, no fields the challenge lacks).
- The server stamps a saved draft with the challenge's current version and refuses a save from a page rendered from an older one (`stale`) — otherwise answers for old question ids would be written under the new version and silently look current.
- Restore keeps what still fits and only says "some answers were reset" when something was actually dropped on a version change — a bare version bump (typo fix, new tip) must not alarm the learner.
- The draft is read on the server and the form starts from it, replacing the "remount after hydration" trick: server and client render the same restored state, so there is nothing to mismatch (and sessionStorage is gone, so one device never shadows another).
- A step change saves immediately, typing after 1 s: the step is a deliberate act worth keeping, while keystrokes would otherwise cost a request each; `pause()` before submit means no save can land after the submit that deletes the draft.
- `tip` is display-only (not in `content_hash`), like `image`: fixing a typo in a hint must not bump the version and so must not make learners' drafts look outdated; the tip shows on the first step that has questions (once per form, not repeated on every quiz question).
- "In progress" needs a draft **and** an open attempt (`canSubmit`): a challenge that is awaiting review or has full points never shows it, even if a stale draft row survives; it replaces "Not started" and sits beside any other status.
- Profile "In progress" reuses the card rule (draft + open attempt) and adds "challenge still visible to the learner": a row is a link into the challenge, so a draft on something since unpublished or hidden from their track is left out rather than leading to a 404.
- A challenge with a draft and earlier attempts is shown only in In progress (best score as a note) and removed from the history list — one row per challenge; its full attempt history stays reachable from the challenge page and submission links.
- `reset:users` is dry-run by default and takes exact emails only — a wipe must never be one forgotten flag or a wildcard away; it prints the Supabase host first so the target is visible, and verifies after deleting.
- The test accounts are always part of a reset and are removed entirely (their data would otherwise block nothing but linger): deleting one also clears the audit rows and evaluation approvals that point at it, because `challenge_settings_audit` forbids a null `changed_by` for admin changes and `evaluations.approved_by` has no ON DELETE action.
- Real accounts keep their profile, track and leaderboard setting; only progress is wiped. Storage is found by listing each user's folder (not from submission rows), so a half-finished run is completed by running it again.
- Pill height is 36px, the header nav's track height (`--rn-h`) and a default button's, not the 30px of the nav's inner items: "same height as the nav items" reads best as the nav's visible control, and 36px is also a comfortable touch target.
- The pills' count and dot are `aria-hidden` and a screen-reader-only sentence carries the same facts in words — the dot alone ("a small dot if it has required challenges left") would mean nothing to a screen reader, and colour must never be the only signal.
- Progress counts the Stepper's steps including Brief and Review, so it reads exactly like the "Step N of M" the learner sees in the form; the current step counts as filled, as in the Stepper's own bars. A single-step challenge shows nothing (the "In progress" badge already says it).
- Cards select `questions` and `submission_spec` to count steps instead of storing a step total on the draft: the total follows the challenge as it is now (a version change can add or remove steps), and a stored number would go stale.
- Overall progress counts every visible challenge (acknowledge ones too), the same set as the pills, so "3 of 13" equals the sum of the pill counts; the old hero stat counted only scored challenges.
- "Required for you" is a section only for learners who have required challenges, and "All required done." replaces the old celebratory box: one quiet line instead of a second block, as the home page now leads with the tracker.
- The card's meta rows moved into a full-width footer band instead of staying in the text column: with the artwork column taking ~100-120px, a one-line row never fitted the narrow cards at any text size; the band is painted over the artwork's lower part (z-5, under the card-wide link at z-10 so the whole card stays clickable).
- Row 1 is the only part that must not wrap, so it is 12px and clips at the very narrowest width rather than reflowing; row 2 is allowed to wrap within itself because its length varies with the badges present.
- The filter state lives in the URL and is changed with `history.pushState`, not the router: a router navigation would re-run the server page (and its Supabase reads) for what is a pure view of data already on the page, and `useSearchParams` still gives reload/back/forward/share for free.
- Sorting is done once on the server and filtering only removes items: the order of what stays never changes between filters, and the client ships no sorting logic.
- Pills stay `<a href>` rather than buttons: a filter that is a URL should behave like one (open in a new tab, copy the link); plain clicks are intercepted, modified clicks are not.
- The selected pill borrows the header nav's thumb/track tokens (instead of a new colour): the pills read as the same kind of control, and the tokens already pass contrast in both themes.
- Without a "Required for you" section a required challenge is no longer singled out by position alone: it is second in the order (after in-progress work), and its Required badge and the dots on the pills carry the rest.
- "Learn" is baseline-aligned to the logo (`align-items: baseline` + a zero line-height word) instead of centred plus a pixel or em nudge: the browser derives the baseline from the font itself, so it holds when the logo height, the font size or even the font changes; a nudge tuned for Urbanist's descender would not.
- The logo shifts down 0.906% of its own height (a percentage `translateY`) so the flat feet of X, D, A, not the SVG's bottom edge (where the U's overshoot reaches), sit on the baseline; the shift scales with the logo, which a pixel value would not.

## Management track and per-question results (`feat/management-track-results`)

- New track `management` ("CEO and COO") in the Team leaderboard group with account manager and assistant: every track belongs to exactly one group, and audience `all` covers it with no content change. Enum values go in their own migration (`20261014090000_management_track.sql`) because a new value can't be used in the transaction that adds it.
- Per-question marks are computed when the attempt page is rendered (answers vs today's `challenge_keys`), not stored: no schema change, and old attempts get them too. The cost is that they're unavailable once the challenge's `version` has moved on (the page says so) — the key only exists for the current version, so grading an old attempt against it would mislabel answers.
- "Full marks" means a published attempt with final score ≥ max score (> 0); "all attempts used" counts every attempt, including ones awaiting review or sent back, like `attemptState`. The state is judged when the page is viewed, so opening attempt 1 after a later perfect attempt shows its right answers. If the attempts can't be read the key stays hidden.
- Correct answers are read with the service role inside `getLearnerAttemptResults` and handed to the component only as option ids for wrong answers once allowed; the component is a server component, so nothing but the rendered HTML reaches the browser. Admins reviewing a submission always get the key.
- "Correct" uses a new `--success` token (text colour, AA on background/card/muted/accent, both themes) and "Incorrect" the existing destructive one; both always come with an icon and the word, never colour alone.
- A quiz graded on the spot (status `published`) redirects to the attempt page after submit instead of staying on the challenge page: the learner is waiting for exactly that result, and the page already applies the reveal rules, so there is one place that decides what is shown. Submissions that go to review stay on the challenge page ("awaiting review"), where the reason they can't resubmit is shown. A "Try again" link appears under the marks only while the key is still hidden.

## Order questions, Latvian letters and fixes (`feat/order-question-and-fixes`)

- New question kind `order`: authors list `items` in the CORRECT order and sync stores them shuffled in the public row (a fixed shuffle seeded by question id + items, rotated if it ever equals the correct order) — the public row is readable by every learner, so it can't hold the real order; a fixed shuffle also means re-syncing unchanged content never bumps the version, and everyone starts from the same scrambled list. The correct sequence lives only in `challenge_keys`, not sorted.
- An untouched order question counts as unanswered ("Put the items in order."): the shuffled start is never correct, so at least one move is always needed anyway, and it stops a learner submitting the scrambled list by accident. Once they move anything the full arrangement is saved (and restored from drafts only when complete).
- Order is graded all-or-nothing on the exact sequence, like `multi`; results use the same ✓/✗ and reveal rules, and a revealed answer is shown as a numbered list ("Correct order:").
- Drag and drop uses `@dnd-kit` (core 6.3.1, sortable 10.0.0, utilities 3.2.2, exact versions): keyboard and touch support that is already accessibility-tested; the drag handle is the only drag target (a finger can still scroll the page), a touch drag needs a 150 ms hold, and every item also has Move up / Move down buttons for anyone who can't or won't drag. Focus follows the moved item after a button move.
- "Try again" on a card shows only beside "View result" (not for Start / Continue, awaiting review, full marks or no attempts left); it links to `/challenges/<slug>#submit` so it lands on the form. It sits above the card-wide link (z-20 over z-10) instead of inside it, as nested links aren't valid.
- Urbanist is self-hosted (full original variable font, OFL) instead of Google's subset: the subset's latin-ext file draws the macron of ā ē ī ū one letter to the right, over the next glyph (reproduced with the served files on their own; the original renders correctly). The original has all the other Latvian letters but no lowercase ģ, so Outfit's ģ (turned comma above, same weight range) is supplied for U+0123 only. That font comes first in `--font-sans`: Urbanist would otherwise build ģ from g + a combining cedilla and never fall through to it.
- Screenshot paste is a document-level listener while the uploader is mounted (the Stepper mounts only the current step), ignoring a paste that is text into a field; a pasted file is renamed "Pasted screenshot" since browsers call every clipboard image "image.png". Drop and paste both go through the same limits as the file picker.
- Brief links to other sites open in a new tab (`noopener noreferrer`) with an external-link icon and a screen-reader note; links into the app (`/challenges/<slug>`, `/categories/<slug>`, `#anchor`, `?query`) stay in the same tab with no icon, as a `next/link` (soft navigation) — the icon and new tab promise "leaves the app", which is false for them. A link counts as internal when it starts with `/` (not `//`), `#` or `?`.
- wf-5's screenshots are optional (`min: 0`) and the rubric scores the component and the "component requests" reference from the Figma file, so the link alone can earn full marks; screenshots only help when the link won't open.
- `claude-rules-at-uxda` replaces `claude-at-uxda` (an acknowledge challenge with the same rules, 0 points, required for everyone) and starts as draft, to be published in the admin panel; the old file is removed so `content:sync` archives it.

## Testers (`feat/order-question-and-fixes`)

- Testers are a flag on `profiles` (`is_tester`) with no UPDATE grant for users: only the service role changes it, through `set_user_tester()`, which refuses a non-admin actor and writes the audit row (`profile_flag_audit`) in the same transaction — the Users action checks admin first, the function checks again. Not a role or a track: any user of any track can be one, and being a tester changes nothing for published challenges.
- The database decides who sees a draft: `challenges_select` also allows `status = 'draft'` for `is_tester()` when `my_track_sees(audiences)` and the category is not archived and visible to the track. Archived stays hidden. The UI (`isChallengeVisible(..., tester)`) and the service-role paths (`loadOpenChallenge`) mirror it, because the submit and draft-save actions read with the service role and RLS can't protect them. `my_track_sees` is false for a user without a track (onboarding comes first anyway).
- Test attempts are `submissions.is_test` rows, not a separate table: they reuse the result page, grading and storage. Counting is enforced by leaving them out, so every read of `submissions` has to filter on `is_test` (or say why not): a source-scanning test fails when a new read forgets. The leaderboard SQL function filters it too.
- Test attempts are numbered on their own (unique `(user, challenge, is_test, attempt)`, check `is_test or attempt <= 3`): real attempts stay capped at 3 in the database, tests are unlimited, and a tester's test attempts neither use up nor are blocked by their real ones.
- Test attempts are published on the spot with the auto-graded part marked: nobody reviews a test, so they never enter the review queue or `eval:pull`. On challenges with screenshots, Figma or written parts the result page says only the questions are marked and shows no "x / max" total (it would be misleading).
- "Starts fresh when published": the owner's SELECT policy on `submissions` only lets them read their own test attempts while the challenge is a draft (a subquery on `challenges.status`); admins always can, and Admin → Content → challenge lists them. Nothing is deleted.
- The correct answers are shown to a tester on test attempts only, as decided. On a published challenge a tester follows the normal reveal rules (`getLearnerAttemptResults` uses `is_test`, not the user's flag), and only real attempts count towards "full marks / 3 attempts used".
- Drafts show in a tester's lists but are never counted: not in category totals, Overall progress, required progress or "completed", whatever `required_for` says in the file. Acknowledge drafts can be read but not confirmed (a confirmation would carry over as real once published).
- Feedback is `challenge_feedback`, admin-read only and written by a server action with the service role after checking, with the user's own session, that RLS lets them read a draft with that slug (a non-tester gets no row). Notes stay when the challenge is published; testers can't read them back.

## Challenge page: the question is the focus (`feat/order-question-and-fixes`)

- A brief that opens with a heading repeating the challenge title is rendered without it (`stripLeadingTitle`, a loose match on case, punctuation and emphasis, first line only), and the content files are not edited: the h1 already says it, and the repeat pushed the first question down. A heading that merely contains the title, or a title that isn't first, stays.
- "Started" (a saved draft, a step past the first, or anything entered) shrinks the brief to its first paragraph with a "Show full brief" button; the stepped form reports it through a small context so the brief, which sits elsewhere on the page, can follow. Opening it is held in component state only and closes again when "started" changes (and on every visit). A brief with nothing after its first paragraph has no toggle. The rubric ("How it's scored") belongs to the full brief, so it hides with it.
- The first paragraph is the first block that isn't a heading, so wireframing briefs that open with a "**Time:** about 20 minutes" line collapse to just that line: the content could put the brief sentence first, but the files are left alone.
- With a stepper the "Your submission" / "Submit again" heading stays for screen readers only (the section keeps its label); without one (single question) it stays visible. The restore notice is one 14px line, "Saved 21 hours ago · Start over", with Start over as a text button that still confirms before discarding.
- Vertical rhythm: page padding 40 -> 32px, section gap 32 -> 24px, meta rows 12 -> 8px, stepper body 20 -> 12px, step content 20 -> 16px. Measured in a browser on a quiz-style page before starting: the first question's heading sits 158px higher (at 1280 and 375px wide), mostly from the removed repeated heading and the removed submission heading.
- The "**Time:** about N minutes" line is removed from the wireframing briefs (wf-1..wf-6): the meta row already shows `estimated_minutes`, and it was the first paragraph, so the collapsed brief showed only the time. Their first paragraph is now the savings-goal brief sentence (a test checks it). It changes the briefs' content hash, so the next `content:sync` bumps those challenges' versions (drafts saved against the old version restore their answers as usual).

## Claude at UXDA is back as a quiz (`feat/restore-claude-at-uxda`)

- `claude-at-uxda` (the 5-question quiz) is restored from git as it was, but with a body that only introduces it ("A few quick questions about how we use our company Claude account. 5 questions, about 3 minutes."): the old body listed the rules, which gave away the answers. `claude-rules-at-uxda` (the acknowledge challenge from the order-question PR) is deleted again, so `content:sync` archives it. `estimated_minutes` is 3 to match the text.

## Security headers and dependency audit (`chore/security-hardening`)

- Every route (pages, route handlers, static files, redirects) sends X-Frame-Options DENY and CSP `frame-ancestors 'none'` (nothing may frame the app), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy that switches off camera, microphone and geolocation (the app uses none; it leaves sound, clipboard paste and WebGL alone) and `Strict-Transport-Security: max-age=31536000`. They live in `src/lib/security-headers.ts` (tested) and are wired in `next.config.ts` `headers()`.
- The Content-Security-Policy is only `frame-ancestors`: a script/connect/img/font policy has to be worked out against the glass X (WebGL and a model file), the self-hosted fonts, the intro sound, Supabase (API, Storage, signed image URLs) and Google sign-in, and a wrong one breaks login silently. `frame-ancestors` can't affect any of them.
- HSTS has no `includeSubDomains` or `preload`: those bind sibling subdomains of the host (some may not serve HTTPS) and are hard to undo; a year of HTTPS for this host is the part that matters. Browsers ignore HSTS on plain http, so localhost is unaffected.
- `npm audit` (npm 10 / Node 22, as in CI) reports 11 issues (5 high, 6 moderate), none fixable without a breaking change or at all: `npm audit fix` changes nothing. `braces` (<=3.0.3) and `sprintf-js` (<=1.1.3) are flagged in every version that exists (the latest releases are 3.0.3 and 1.1.3), so there is nothing to upgrade to; their parents (micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next; argparse, js-yaml, gray-matter) are only flagged through them, and npm's "fix" for them is a downgrade to eslint-config-next 14 / gray-matter 2. `postcss-selector-parser` has a fix (7.1.6) but @tailwindcss/typography pins 6.0.10 exactly, so it would need an override across a major version.
- Which of them touch production: none ship. The only runtime-listed one is gray-matter -> js-yaml 3 -> argparse 1 -> sprintf-js (4 moderate), used by `src/lib/content/load.ts`, i.e. the `content:*` and `eval:*` scripts that read the repo's own markdown files on an admin's machine; no app route imports it and the built `.next` output contains none of these packages. The other 7 (braces, micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next, @tailwindcss/typography, postcss-selector-parser) are devDependencies: the linter and the Tailwind build.
- CI runs `npm run audit:prod` (`npm audit --omit=dev --audit-level=high`) as the last step: it fails only on high or critical advisories in production dependencies. Dev tools are left out because the linter and the Tailwind build never ship, and moderate issues are reported but don't block (today: none high in production, so it passes). It runs last so a new advisory never hides a type, test or build failure. Because advisories are published independently of our code, it can turn red on an untouched branch; when it does, upgrade the package (`npm audit fix`, or bump the parent), and if no fix exists and it doesn't reach production, say why here and raise `--audit-level` to `critical` for the time being (npm has no per-advisory allowlist). A registry outage also fails it; re-run.

## Home: sections and a filter menu (`feat/home-sections-filter`)

- Under "All" the Challenges list is grouped by category, in the categories' sort order, each group a small bold label (name + done/total) over its cards; inside a group the existing sort holds (in progress, required not done, other not started, completed), because the global sort is by tier first and grouping only filters it. Card headings drop to h4 under the group's h3 (the card itself is unchanged).
- The pills row is replaced by a Filter button on the right of the Challenges heading: a Radix DropdownMenu with radio items (All, each category with done/total and a dot + "required left", and for testers "Drafts — testing" with the number of drafts, even at 0). It is non-modal: a modal menu marks everything else aria-hidden, including the Filter button, which axe flags (aria-hidden-focus) and which gains nothing here. Keyboard, Escape and returning focus to the button come from Radix. The button always names the active filter ("Filter: All"). Options are no longer links, so "open in a new tab" per option is gone; the URL (`?category=slug`, `drafts` for testers, via `history.pushState`) still carries the state.
- A chosen filter shows only that group, without its label. `?category=drafts` means All for anyone who isn't a tester.
- Drafts never appear under All or in a category, nor in any count, and the category page lists published challenges only again (testers reached drafts there since the testers PR): they live under the tester's Drafts filter and by direct link. They are separate from `challenges` in `HomeData` so a draft can't leak into a group, and draft cards are dashed with a muted surface and the "Draft — testing" badge.
- Leaderboard: people with 0 points have no rank (a dash, "No rank yet" for screen readers) and are listed after everyone else under a small "Not started yet" label, by name; the others keep competition ranking (1, 2, 2, 4). The home hero's "#N of M" counts only people with points, and a user with none sees "Not ranked yet" (only a user who chose to be hidden sees the "hidden from the leaderboard" link).


## Learning paths (`feat/learning-paths`)

- A path is its own file (`content/paths/<slug>.yaml`) plus `path:` on each milestone, and the order lives only in the path's `milestones` list — the path reads top to bottom in one place; validation checks the two sides agree.
- `challenges.path_slug` is display-only (not in content_hash), like `image` and `tip` — joining or leaving a path doesn't change what is graded, so it must not bump `version`.
- A milestone unlocks once the previous one has ANY real attempt (awaiting review and changes requested count), and a milestone with its own attempt is never locked — learners never wait for a review, and imported progress can skip ahead.
- Locking is checked in the page (redirect to the path) and in submit + draft save (`milestoneGate`), not in RLS — it's a progression rule, not a secret: the brief is one sentence and a Figma link.
- A milestone is visible only with its path; a draft milestone in a published path stays hidden, even from testers — a live path's "x of y" must never include something nobody can do yet.
- A path counts as ONE item in home/category/filter counts and Overall progress (done = every milestone done); its points are the sum of its milestones' best scores. The leaderboard's "completed" still counts challenges (milestones individually) — unchanged, it's per challenge by design.
- Milestones can't be required or have a due date (validation + Admin → Content shows only Status for them) — required counts are per challenge, and a milestone isn't listed on its own; required paths can come later as a path-level setting.
- Publishing a path in Admin → Content publishes its draft milestones in the same transaction (`set_path_status(..., p_publish_milestones)`), each change in that challenge's own history — eight clicks would invite a half-published path.
- Imported progress is a normal REAL attempt (`is_imported`, `imported_by`, `imported_at`) written only by `import_submission()` — points, leaderboard, profile and exports work unchanged, and the function re-checks admin actor, published path, track visibility and the attempt rules.
- Imports only into a published path — published submissions count on the leaderboard regardless of the challenge's status, so importing into a draft would show points for something nobody can see, and testers would see real and test attempts mixed.
- An import uses one of the 3 attempts — it is an attempt; Deniss's Final Boss is imported as published 36/40 (not changes requested), so it counts now and "Try again" reaches full points.
- "Undo import" deletes the attempt only when it's the user's latest on that milestone, and both steps stay in `submission_import_audit` (no FK to submissions) — attempt numbers stay 1..3 without gaps, and the history survives the undo.
- The import script is a dry run unless `--apply`, needs `--as <admin email>` (recorded as `imported_by`), skips people who haven't signed in and milestones already imported — so it can be re-run after more people sign in.
- `submissions.imported_by` is a second FK to profiles, so embeds name theirs (`profiles!submissions_user_id_fkey`) — PostgREST can't pick one otherwise.
- The path page's markup lives in a data-free `PathView` (like `HomeView`) — it can be rendered with sample data for browser checks.

## Designer paths (`feat/designer-paths`)

- "Before you start" is its own optional path field (`before_you_start`, markdown ≤ 600 chars, new column) shown at the top of the path page — it's what to set up before milestone 1, unlike "Before you submit", which is a checklist for each submission.
- Brief images: markdown `![alt](/challenges/file.png)` from `public/challenges/` only (same folder and file rule as card artwork), alt text required by `content:validate`; anything else isn't rendered — no remote images in the app, and every image has a text alternative.
- Images are left out of a derived summary — "!alt" in a one-line summary says nothing.
- Commands in the new briefs are bold (**/harvest**), like the existing briefs — inline code shows literal backticks with the typography plugin.
- Milestones that ask for "one per design system" set `screenshots.min: 3` — the form then asks for all three.

## Designer path order (`feat/designer-path-order`)

- Side images are grouped with the block before them by a small remark step (text first in the DOM), not floated — so on a phone the image lands below its text, and nothing wraps oddly around it.
- `"side"` is the only image title, and a side image needs an empty line before and after — otherwise markdown joins it to the list or paragraph above and it silently renders inline.
- Brief images open in a Radix dialog (focus trap, Escape, focus return, alt text as its name) rather than a new tab — it stays in the brief and works with the keyboard.
- `requires` is content (synced every time, like `milestones`): the order of paths is part of the curriculum, not an admin setting.
- A required path counts as done when every milestone has an attempt — the same "any attempt" rule as milestones, so nobody waits for a review.
- A required path the learner can't see (draft for a non-tester, archived) holds nothing back — otherwise a path could be locked forever by something nobody can do.
- A path the learner already has an attempt in is never locked (as for milestones), so imported progress keeps working.
- brand-the-template now requires connect-design-systems too, so the three designer paths run in order.

## Path chains (`feat/path-chains`)

- A chain sits where the step the learner is on sorts (the first path that isn't done; step 1 once all are), so a chain whose first step is done moves up with the step in progress instead of dropping to the completed cards. Inside the chain the order is always the unlock order.
- Steps are numbered over the paths the learner can see (drafts too, for a tester), the same on home and the category page, so a card says the same "Step N of M" everywhere.

## Testers open every draft step (`feat/tester-open-all`)

- The bypass is per milestone, on draft milestones only (the ones a tester's attempts are tests on): a published milestone inside a draft path still follows the locks, so a tester can never skip ahead for real points.
- A bypassed milestone keeps the "locked" status (what learners see) with a separate `testerOverride` flag, so testers can still check the lock wording, and every server gate reads the same `unlocked` value.
- Track `assistant` shown as "Marketing Assistant" — label only (`src/lib/tracks.ts`); the enum value stays `assistant`, so no migration and existing profiles, content audiences and `required_for` are unchanged.
- Job titles keyed by lowercase email in their own table (`staff_titles`), not a profile column — titles can be set before someone's first sign-in and a wrong seeded email can be fixed without touching profiles.
- Title writes go through SQL functions (`set_staff_title`, `rename_staff_email`) that write the `staff_audit` row in the same transaction, like `set_user_tester` — not a trigger, so each row knows its source (admin / seed) and actor.
- One `staff_audit` table (text old/new) for titles, title emails and track changes, including the migration that moved account managers and assistants to management (`source = 'migration'`, `note` names it).
- Account manager and Marketing Assistant are hidden (`selectable: false`), not removed: the enum values stay, so old content, history and audit rows keep their labels and no enum migration is needed. The server refuses them on onboarding and Admin → Users; leaderboard groups only hold selectable tracks.
- A seeded email can only be renamed while nobody has signed in with it (checked in SQL): a signed-in person's email comes from Google.
- `content:validate` only warns (never fails) on content aimed only at hidden tracks: it's harmless, just never seen.
- `waiting_minutes` is part of `estimated_minutes`, not added to it; hands-on time is calculated (`timeOf`), never stored — one source for the total, and the two can't disagree.
- `waiting_minutes` is in `content_hash` only when set — challenges without it keep their hash, so adding the column causes no version bumps or hash refreshes.
- On challenge cards the split time gets its own row under the one-line meta row (it would be clipped there); a plain "~20 min" stays in the row.
- A path's time adds up only the milestones that have an estimate; no estimate at all → no time shown.
