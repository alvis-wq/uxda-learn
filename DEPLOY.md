# Deploying UXDA Learn

The app is a standard Next.js Node server — no Vercel-only features — so any host that runs
Node 22 works (Vercel, Render, Fly.io, Railway, a VM or container).

```bash
npm ci
npm run build      # NEXT_PUBLIC_* vars must be set at build time (they're inlined)
npm start          # serves on $PORT (default 3000)
```

`src/proxy.ts` (Next 16's "middleware") runs on the Node.js runtime; nothing needs the Edge runtime.

## Environment variables

| Variable | Production | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** (build + runtime) | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** (build + runtime) | Publishable/anon key — safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** (runtime, server-only) | Secret key. Never expose; mark as secret in the host. Rotate in Supabase if leaked |
| `ENABLE_TEST_LOGIN` | **Must be unset or `false`** | Test login is also hard-disabled when `NODE_ENV=production` |
| `ALLOWED_EMAIL_DOMAINS` | **Required** (runtime, server-only) | e.g. `uxdesignagency.com` (comma-separated for several). Must match the DB's `allowed_email_domains` — run `npm run seed:domains` after changing it |
| `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `ADMIN_EMAILS` | Not needed | Only for local scripts (migrations, types, seeding) |
| `TEST_SUPABASE_*` | **Never** | Test project for E2E/integration only |

`next start` sets `NODE_ENV=production`, which keeps test login off even if the flag leaks in.

## Supabase settings

**Authentication → URL Configuration**
- **Site URL:** `https://<your-domain>`
- **Redirect URLs** (add, keep the localhost one for development):
  - `https://<your-domain>/auth/callback`
  - `http://localhost:3000/**`
  - Preview deployments, if you use them: e.g. `https://*-<team>.vercel.app/auth/callback`
    (or the equivalent pattern for your host)

**Authentication → Providers → Google:** already enabled. The Google OAuth client's authorised
redirect URI is Supabase's own callback (`https://<ref>.supabase.co/auth/v1/callback`), so a new
app domain needs **no** change in Google Cloud — only the Supabase redirect URLs above.
Keep the OAuth consent screen set to **Internal** (UXDA Workspace accounts only).

**Optional hardening:** sign-in is Google-only, so you can disable email sign-ups
(Authentication → Providers → Email). Note that dev test login and the test project rely on
email auth; keep it enabled there.

## Before the first deploy

Run from a machine with the main project's `.env.local`:

```bash
npm run db:push          # migrations
npm run seed:domains     # ALLOWED_EMAIL_DOMAINS → allowed_email_domains (sign-up gate)
npm run db:check         # RLS / private tables / signup domain guard
npm run seed:admins      # Alvis (and any other ADMIN_EMAILS) become admins on first sign-in
npm run content:sync     # publish content
```

## Smoke test after deploying

1. `/login` loads and shows **only** "Sign in with Google" (no "Test login" card).
2. Sign in with an account on an `ALLOWED_EMAIL_DOMAINS` domain → onboarding → home lists categories.
3. Sign in with any other Google account → "This account can't be used here".
4. Submit a published quiz → it's graded and shows "Completed".
5. Upload a screenshot on a screenshot challenge → "Awaiting review".
6. As a non-admin, open `/admin` → "Access denied" (HTTP 403).
7. As an admin: review queue, approve a submission, export scores CSV.

## Weekly evaluation

`/evaluate` runs locally in Claude Code against the main project (`eval:pull` / `eval:push`
need `SUPABASE_SERVICE_ROLE_KEY`). Nothing about it runs on the host.
