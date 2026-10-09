import { requireEnv } from "./env";

const API = "https://api.supabase.com/v1";

function headers() {
  return {
    Authorization: `Bearer ${requireEnv("SUPABASE_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

function projectUrl(path: string) {
  return `${API}/projects/${requireEnv("SUPABASE_PROJECT_REF")}${path}`;
}

/** Run SQL as the `postgres` role via the Supabase Management API. Returns the last statement's rows. */
export async function runSql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(projectUrl("/database/query"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API SQL failed (${res.status}): ${text}`);
  }
  return text ? (JSON.parse(text) as T[]) : [];
}

export async function getTypescriptTypes(schemas = ["public"]): Promise<string> {
  const res = await fetch(
    projectUrl(`/types/typescript?included_schemas=${encodeURIComponent(schemas.join(","))}`),
    { headers: headers() },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Type generation failed (${res.status}): ${body}`);
  return (JSON.parse(body) as { types: string }).types;
}

/** Quote a string as a SQL literal. */
export function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
