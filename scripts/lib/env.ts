import { existsSync } from "node:fs";

// Scripts run outside Next.js, so load .env.local ourselves.
// Existing process env vars (e.g. in cloud sessions / CI) take precedence.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}
