import { existsSync } from "node:fs";

// Vitest doesn't load .env files into process.env; existing env vars win.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
