import {
  canonicalJson,
  hashPublicContent,
  normalizeTimestamp,
  type CategoryRow,
  type ChallengeKeyRow,
  type ChallengeRow,
  type ChallengeSettings,
  type PublicChallengeContent,
  type SettingField,
} from "./transform";

export type DbCategory = CategoryRow;
export type DbChallenge = PublicChallengeContent & {
  image?: string | null; // undefined until the image migration has been applied
  content_hash: string;
  version: number;
  status: string;
  required_for: string[];
  due_at: string | null;
};
export type DbKey = { challenge_slug: string; answer_key: unknown; grader_notes: string | null };

export type SyncPlan = {
  categoryUpserts: { row: CategoryRow; action: "create" | "update" }[];
  categoryArchives: string[];
  /**
   * Content writes. `settings` (status, required_for, due_at from the file) is only present on
   * create — after that the admin panel owns them and an update never touches them.
   */
  challengeWrites: (
    | { action: "create"; row: ChallengeRow & { version: number }; settings: ChallengeSettings; key: ChallengeKeyRow }
    | { action: "update"; row: ChallengeRow & { version: number }; key: ChallengeKeyRow }
  )[];
  /** Same content, but the stored hash is stale (e.g. after a format change). Never bumps the version. */
  challengeHashRefreshes: { slug: string; content_hash: string }[];
  /** Only the card image changed: written without bumping the version (it isn't part of the content hash). */
  challengeImageUpdates: { slug: string; image: string | null }[];
  challengeArchives: string[];
  /** File and DB disagree on an admin-owned setting. Informational only: the DB wins, nothing is written. */
  settingsDrift: { slug: string; field: SettingField; file: string; db: string }[];
};

/** Number of writes the plan would make (settings drift is informational and not counted). */
export function countChanges(plan: SyncPlan): number {
  return (
    plan.categoryUpserts.length +
    plan.categoryArchives.length +
    plan.challengeWrites.length +
    plan.challengeHashRefreshes.length +
    plan.challengeImageUpdates.length +
    plan.challengeArchives.length
  );
}

function sameCategory(a: CategoryRow, b: CategoryRow): boolean {
  return (
    a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    a.audiences.join() === b.audiences.join() &&
    a.sort_order === b.sort_order &&
    a.archived === b.archived &&
    (a.image ?? null) === (b.image ?? null)
  );
}

function sameKey(a: ChallengeKeyRow, b: DbKey | undefined): boolean {
  if (!b) return false;
  return (
    canonicalJson(a.answer_key) === canonicalJson(b.answer_key ?? {}) &&
    (a.grader_notes ?? null) === (b.grader_notes ?? null)
  );
}

/** Display form of a setting, used to compare file vs DB and in the sync output. */
function settingText(field: SettingField, value: unknown): string {
  if (field === "required_for") {
    const list = (value as string[] | null) ?? [];
    return list.length ? `[${list.join(", ")}]` : "optional";
  }
  if (field === "due_at") return normalizeTimestamp(value as string | null) ?? "none";
  return String(value);
}

function drift(slug: string, file: ChallengeSettings, db: DbChallenge): SyncPlan["settingsDrift"] {
  const out: SyncPlan["settingsDrift"] = [];
  for (const field of ["status", "required_for", "due_at"] as const) {
    const f = settingText(field, file[field]);
    const d = settingText(field, db[field]);
    if (f !== d) out.push({ slug, field, file: f, db: d });
  }
  return out;
}

/**
 * Pure diff between content on disk and what's in the DB.
 * - New challenge → create, including status / required_for / due_at from the file.
 * - Changed public content or keys → content write with version + 1. Settings are left alone.
 * - Stored hash differs but the DB row's public fields hash the same as disk (e.g. after a
 *   format change) → hash refresh, no version bump.
 * - Only the card image differs → image update, no version bump (display only).
 * - Settings that differ between file and DB → reported as drift, never written (DB wins).
 * - In DB but not on disk → archived (never deleted).
 */
export function planSync(
  disk: {
    categories: CategoryRow[];
    challenges: { challenge: ChallengeRow; settings: ChallengeSettings; key: ChallengeKeyRow }[];
  },
  db: { categories: DbCategory[]; challenges: DbChallenge[]; keys: DbKey[] },
): SyncPlan {
  const plan: SyncPlan = {
    categoryUpserts: [],
    categoryArchives: [],
    challengeWrites: [],
    challengeHashRefreshes: [],
    challengeImageUpdates: [],
    challengeArchives: [],
    settingsDrift: [],
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
  for (const { challenge, settings, key } of disk.challenges) {
    const existing = dbChallenges.get(challenge.slug);
    if (!existing) {
      plan.challengeWrites.push({ action: "create", row: { ...challenge, version: 1 }, settings, key });
      continue;
    }
    plan.settingsDrift.push(...drift(challenge.slug, settings, existing));
    const publicChanged =
      existing.content_hash !== challenge.content_hash && hashPublicContent(existing) !== challenge.content_hash;
    if (publicChanged || !sameKey(key, dbKeys.get(challenge.slug))) {
      plan.challengeWrites.push({ action: "update", row: { ...challenge, version: existing.version + 1 }, key });
    } else if (existing.content_hash !== challenge.content_hash) {
      plan.challengeHashRefreshes.push({ slug: challenge.slug, content_hash: challenge.content_hash });
    }
    // A content write already carries the image; otherwise a changed image is its own version-neutral write.
    const contentWritten = plan.challengeWrites.at(-1)?.row.slug === challenge.slug;
    if (!contentWritten && (existing.image ?? null) !== (challenge.image ?? null)) {
      plan.challengeImageUpdates.push({ slug: challenge.slug, image: challenge.image ?? null });
    }
  }
  const diskChallengeSlugs = new Set(disk.challenges.map((c) => c.challenge.slug));
  for (const c of db.challenges) {
    if (!diskChallengeSlugs.has(c.slug) && c.status !== "archived") plan.challengeArchives.push(c.slug);
  }

  return plan;
}
