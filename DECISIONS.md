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
