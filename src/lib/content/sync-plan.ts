import {
  canonicalJson,
  hashPublicContent,
  type CategoryRow,
  type ChallengeKeyRow,
  type ChallengeRow,
  type PublicChallengeContent,
} from "./transform";

export type DbCategory = CategoryRow;
export type DbChallenge = PublicChallengeContent & {
  content_hash: string;
  version: number;
  status: string;
  required_for: string[];
};
export type DbKey = { challenge_slug: string; answer_key: unknown; grader_notes: string | null };

export type SyncPlan = {
  categoryUpserts: { row: CategoryRow; action: "create" | "update" }[];
  categoryArchives: string[];
  challengeWrites: {
    row: ChallengeRow & { version: number };
    key: ChallengeKeyRow;
    action: "create" | "update";
  }[];
  /** No content change: status, required_for and/or a stale stored hash. Never bumps the version. */
  challengeMetaUpdates: {
    slug: string;
    status: ChallengeRow["status"];
    required_for: ChallengeRow["required_for"];
    content_hash: string;
  }[];
  challengeArchives: string[];
};

export function countChanges(plan: SyncPlan): number {
  return (
    plan.categoryUpserts.length +
    plan.categoryArchives.length +
    plan.challengeWrites.length +
    plan.challengeMetaUpdates.length +
    plan.challengeArchives.length
  );
}

function sameCategory(a: CategoryRow, b: CategoryRow): boolean {
  return (
    a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    a.audiences.join() === b.audiences.join() &&
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
 * - Status / required_for change → metadata update, no version bump.
 * - Stored hash differs but the DB row's public fields hash the same as disk (e.g. after a
 *   format migration) → hash refresh, no version bump.
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
    challengeMetaUpdates: [],
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
    const publicChanged =
      existing.content_hash !== challenge.content_hash && hashPublicContent(existing) !== challenge.content_hash;
    if (publicChanged || !sameKey(key, dbKeys.get(challenge.slug))) {
      plan.challengeWrites.push({
        row: { ...challenge, version: existing.version + 1 },
        key,
        action: "update",
      });
    } else if (
      existing.status !== challenge.status ||
      (existing.required_for ?? []).join() !== challenge.required_for.join() ||
      existing.content_hash !== challenge.content_hash
    ) {
      plan.challengeMetaUpdates.push({
        slug: challenge.slug,
        status: challenge.status,
        required_for: challenge.required_for,
        content_hash: challenge.content_hash,
      });
    }
  }
  const diskChallengeSlugs = new Set(disk.challenges.map((c) => c.challenge.slug));
  for (const c of db.challenges) {
    if (!diskChallengeSlugs.has(c.slug) && c.status !== "archived") plan.challengeArchives.push(c.slug);
  }

  return plan;
}
