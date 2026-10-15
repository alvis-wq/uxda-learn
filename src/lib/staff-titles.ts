import { z } from "zod";

/**
 * Job titles shown under people's names. Stored in staff_titles, keyed by lowercase email so a title can be set
 * before someone first signs in; joined to profiles by lowercase email.
 */

export const JOB_TITLE_MAX = 80;

export const staffEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email."));

/** An empty title means "no title" (the row is removed). */
export const jobTitleSchema = z
  .string()
  .trim()
  .max(JOB_TITLE_MAX, `Keep it under ${JOB_TITLE_MAX} characters.`);

/** data/staff-titles.json: a list of { email, job_title }, each email once. */
export const staffTitlesFileSchema = z
  .array(z.object({ email: staffEmailSchema, job_title: jobTitleSchema.min(1, "Title is empty.") }).strict())
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (seen.has(r.email)) ctx.addIssue({ code: "custom", path: [i, "email"], message: `${r.email} is listed twice.` });
      seen.add(r.email);
    });
  });

export type StaffTitle = { email: string; job_title: string };

export type StaffTitlesPlan = {
  add: StaffTitle[];
  change: (StaffTitle & { old: string })[];
  same: StaffTitle[];
  /** In the database but not in the file: left alone (the seed only adds and updates). */
  untouched: StaffTitle[];
};

/** What seeding `wanted` over `existing` would do (upsert by email; nothing is deleted). */
export function planStaffTitles(wanted: readonly StaffTitle[], existing: readonly StaffTitle[]): StaffTitlesPlan {
  const current = new Map(existing.map((r) => [r.email.toLowerCase(), r.job_title]));
  const wantedEmails = new Set(wanted.map((r) => r.email));
  const plan: StaffTitlesPlan = { add: [], change: [], same: [], untouched: [] };
  for (const r of wanted) {
    const old = current.get(r.email);
    if (old === undefined) plan.add.push(r);
    else if (old !== r.job_title) plan.change.push({ ...r, old });
    else plan.same.push(r);
  }
  plan.untouched = existing.filter((r) => !wantedEmails.has(r.email.toLowerCase()));
  return plan;
}

/** Title lookup by email, case-insensitive. */
export function titleIndex(rows: readonly StaffTitle[]): (email: string | null | undefined) => string | undefined {
  const map = new Map(rows.map((r) => [r.email.toLowerCase(), r.job_title]));
  return (email) => (email ? map.get(email.toLowerCase()) : undefined);
}

/** Seeded emails nobody has signed in with yet (shown on Admin → Users so wrong emails can be fixed). */
export function notSignedIn(rows: readonly StaffTitle[], profileEmails: readonly string[]): StaffTitle[] {
  const signedIn = new Set(profileEmails.map((e) => e.toLowerCase()));
  return rows.filter((r) => !signedIn.has(r.email.toLowerCase())).sort((a, b) => a.email.localeCompare(b.email));
}
