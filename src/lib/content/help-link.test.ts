import { describe, expect, it } from "vitest";
import { parseChallenge, type ChallengeRow as DbChallengeRow } from "@/lib/challenges/model";
import type { LoadedContent } from "./load";
import { challengeParts, findPlaceholders } from "./placeholders";
import { challengeFrontmatterSchema, helpLinkSchema, isHttpsUrl } from "./schema";
import { planSync } from "./sync-plan";
import { toChallengeRows } from "./transform";
import { contentWarnings } from "./validate";

const PLAYBOOK = { url: "https://www.figma.com/design/LGZoFgcZNZPl72DDRv9n0A/UXDA-Playbook?node-id=2482-30725", label: "the UXDA Playbook" };

const frontmatter = (over: Record<string, unknown> = {}) =>
  challengeFrontmatterSchema.parse({
    slug: "check", title: "Check", category: "basics", type: "quiz", feedback_mode: "instant", difficulty: 1, points: 2,
    questions: [{ id: "q1", kind: "single", prompt: "P", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], answer: "a", points: 2 }],
    help_link: PLAYBOOK,
    ...over,
  });
const categories = [{ slug: "basics", title: "Basics", audiences: ["all" as const], sort_order: 0 }];
const loaded = (data = frontmatter()) => ({ file: `challenges/${data.slug}.md`, data, body: "Brief." });

describe("help_link in content", () => {
  it("accepts an https link with a label", () => {
    expect(helpLinkSchema.safeParse(PLAYBOOK).success).toBe(true);
  });

  it.each([
    ["http", { url: "http://example.com/x", label: "L" }],
    ["no scheme", { url: "www.figma.com/x", label: "L" }],
    ["javascript:", { url: "javascript:alert(1)", label: "L" }],
    ["a space", { url: "https://example.com/a b", label: "L" }],
    ["an empty label", { url: "https://example.com", label: " " }],
    ["a long label", { url: "https://example.com", label: "x".repeat(121) }],
    ["an extra key", { ...PLAYBOOK, title: "x" }],
    ["no label", { url: "https://example.com" }],
  ])("rejects %s", (_label, link) => {
    expect(helpLinkSchema.safeParse(link).success).toBe(false);
  });

  it("isHttpsUrl agrees with the database check", () => {
    expect(isHttpsUrl(PLAYBOOK.url)).toBe(true);
    expect(isHttpsUrl("https://")).toBe(false);
    expect(isHttpsUrl("HTTPS://x.com\n")).toBe(false);
  });

  it("is display only: in the row, not in the hash", () => {
    const withLink = toChallengeRows(loaded(), categories);
    const without = toChallengeRows(loaded(frontmatter({ help_link: undefined })), categories);
    expect(withLink.challenge.help_link).toEqual(PLAYBOOK);
    expect(without.challenge.help_link).toBeNull();
    expect(withLink.challenge.content_hash).toBe(without.challenge.content_hash);
  });

  it("syncs a changed link without bumping the version", () => {
    const { challenge, settings, key } = toChallengeRows(loaded(), categories);
    const db = { categories: [], challenges: [{ ...challenge, ...settings, help_link: null, version: 4 }], keys: [key] };
    const plan = planSync({ categories: [], challenges: [{ challenge, settings, key }] }, db);
    expect(plan.challengeWrites).toEqual([]);
    expect(plan.challengeDisplayUpdates).toMatchObject([{ slug: "check", help_link: PLAYBOOK }]);
    // The same link read back from the DB (keys in another order) is no change.
    const same = { ...db, challenges: [{ ...db.challenges[0], help_link: { label: PLAYBOOK.label, url: PLAYBOOK.url } }] };
    expect(planSync({ categories: [], challenges: [{ challenge, settings, key }] }, same).challengeDisplayUpdates).toEqual([]);
  });

  it("warns when the challenge isn't instant mode (nothing shows it there)", () => {
    const content = (data: ReturnType<typeof frontmatter>): LoadedContent => ({ categories, challenges: [loaded(data)], paths: [], errors: [] });
    expect(contentWarnings(content(frontmatter())).map((w) => w.message)).toEqual([]);
    expect(contentWarnings(content(frontmatter({ feedback_mode: "final" }))).map((w) => w.message)).toEqual([
      "help_link: only shown in instant mode (feedback_mode: instant), so nobody will see it here",
    ]);
  });

  it("counts as content for placeholders", () => {
    const hits = findPlaceholders(challengeParts({ title: "T", body: "B", help_link: { url: "https://x.com", label: "TODO_LABEL" } }));
    expect(hits).toMatchObject([{ token: "TODO_LABEL", where: "help link" }]);
  });

  it("drops a malformed stored link instead of showing it", () => {
    const row = (help_link: unknown) =>
      parseChallenge({ ...toChallengeRows(loaded(), categories).challenge, version: 1, status: "draft", required_for: [], due_at: null, updated_at: "", help_link } as unknown as DbChallengeRow);
    expect(row(PLAYBOOK).help_link).toEqual(PLAYBOOK);
    expect(row({ url: "http://x.com", label: "L" }).help_link).toBeNull();
    expect(row(null).help_link).toBeNull();
  });
});
