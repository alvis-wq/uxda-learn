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
