import {
  canonicalJson,
  type CategoryRow,
  type ChallengeKeyRow,
  type ChallengeRow,
} from "./transform";

export type DbCategory = CategoryRow;
export type DbChallenge = { slug: string; content_hash: string; version: number; status: string };
export type DbKey = { challenge_slug: string; answer_key: unknown; grader_notes: string | null };

export type SyncPlan = {
  categoryUpserts: { row: CategoryRow; action: "create" | "update" }[];
  categoryArchives: string[];
  challengeWrites: {
    row: ChallengeRow & { version: number };
    key: ChallengeKeyRow;
    action: "create" | "update";
  }[];
  challengeStatusUpdates: { slug: string; status: ChallengeRow["status"] }[];
  challengeArchives: string[];
};

export function countChanges(plan: SyncPlan): number {
  return (
    plan.categoryUpserts.length +
    plan.categoryArchives.length +
    plan.challengeWrites.length +
    plan.challengeStatusUpdates.length +
    plan.challengeArchives.length
  );
}

function sameCategory(a: CategoryRow, b: CategoryRow): boolean {
  return (
    a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    a.audience === b.audience &&
    a.sort_order === b.sort_order &&
    a.archived === b.archived
  );
}

function sameKey(a: ChallengeKeyRow, b: DbKey | undefined): boolean {
  if (!b) return false;
  return (
    canonicalJson(a.answer_key) === canonicalJson(b.answer_key ?? {}) &&
    (a.grader_notes ?? null) === (b.grader_notes ?? null)
  );
}

/**
 * Pure diff between content on disk and what's in the DB.
 * - New or changed content → write; changed public content or keys → version + 1.
 * - Status-only change → status update, no version bump.
 * - In DB but not on disk → archived (never deleted).
 */
export function planSync(
  disk: { categories: CategoryRow[]; challenges: { challenge: ChallengeRow; key: ChallengeKeyRow }[] },
  db: { categories: DbCategory[]; challenges: DbChallenge[]; keys: DbKey[] },
): SyncPlan {
  const plan: SyncPlan = {
    categoryUpserts: [],
    categoryArchives: [],
    challengeWrites: [],
    challengeStatusUpdates: [],
    challengeArchives: [],
  };

  const dbCats = new Map(db.categories.map((c) => [c.slug, c]));
  for (const row of disk.categories) {
    const existing = dbCats.get(row.slug);
    if (!existing) plan.categoryUpserts.push({ row, action: "create" });
    else if (!sameCategory(row, existing)) plan.categoryUpserts.push({ row, action: "update" });
  }
  const diskCatSlugs = new Set(disk.categories.map((c) => c.slug));
  for (const c of db.categories) {
    if (!diskCatSlugs.has(c.slug) && !c.archived) plan.categoryArchives.push(c.slug);
  }

  const dbChallenges = new Map(db.challenges.map((c) => [c.slug, c]));
  const dbKeys = new Map(db.keys.map((k) => [k.challenge_slug, k]));
  for (const { challenge, key } of disk.challenges) {
    const existing = dbChallenges.get(challenge.slug);
    if (!existing) {
      plan.challengeWrites.push({ row: { ...challenge, version: 1 }, key, action: "create" });
      continue;
    }
    const contentChanged =
      existing.content_hash !== challenge.content_hash || !sameKey(key, dbKeys.get(challenge.slug));
    if (contentChanged) {
      plan.challengeWrites.push({
        row: { ...challenge, version: existing.version + 1 },
        key,
        action: "update",
      });
    } else if (existing.status !== challenge.status) {
      plan.challengeStatusUpdates.push({ slug: challenge.slug, status: challenge.status });
    }
  }
  const diskChallengeSlugs = new Set(disk.challenges.map((c) => c.challenge.slug));
  for (const c of db.challenges) {
    if (!diskChallengeSlugs.has(c.slug) && c.status !== "archived") plan.challengeArchives.push(c.slug);
  }

  return plan;
}
