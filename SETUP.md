# Setup — do this before starting Claude Code

Claude Code can't create accounts or OAuth clients. Do these once (~30 min).

## 1. Folder + repo
```bash
mkdir -p ~/Projects/uxda-learn && cd ~/Projects/uxda-learn
# unzip this build pack here
git init && git add . && git commit -m "build pack"
```
Optional: create a private repo in UXDA-org on GitHub and add it as `origin`.

## 2. Supabase
1. Create a new project (EU region, e.g. Frankfurt).
2. Copy: Project URL, anon (publishable) key, service_role (secret) key, project ref.
3. Install the Supabase CLI, then:
```bash
supabase login
supabase init
supabase link --project-ref <your-ref>
```

## 3. Google login
1. Google Cloud Console → new project → OAuth consent screen → User type **Internal**
   (limits sign-in to UXDA Google Workspace accounts).
2. Credentials → Create OAuth client ID → Web application.
   Authorized redirect URI: `https://<your-ref>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google → paste Client ID + Secret, enable.
4. Supabase → Authentication → URL Configuration:
   Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**`
   (add the Vercel URL later).

## 4. Environment
Copy `.env.example` → `.env.local` and fill in every value.
Set `ENABLE_TEST_LOGIN=true` only for local development (never in production).
Optional: a second Supabase project for E2E/integration tests (`TEST_SUPABASE_*`) — see README → Testing.

## 5. Claude Code
- Make sure the Figma MCP is connected (needed later for `/evaluate`).
- Optional: Vercel CLI logged in + `vercel link` if you want Claude to deploy a preview.
- Start in auto mode:
```bash
claude --enable-auto-mode     # then Shift+Tab to select auto mode
```
- First prompt:
> Read CLAUDE.md and BUILD_PLAN.md, then execute the build plan from Phase 0 to the end. Follow the execution loop and decision policy; only stop for the listed stop conditions.
