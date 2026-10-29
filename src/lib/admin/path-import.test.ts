import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAndValidate } from "@/lib/content";
import { importBlocker, importFileSchema, importInputSchema, planImport, type ImportFile } from "./path-import";

const ROOT = path.resolve(__dirname, "../../..");
const USER = "11111111-1111-4111-8111-111111111111";

describe("importInputSchema", () => {
  it("accepts a done import with the default note", () => {
    expect(
      importInputSchema.safeParse({ userId: USER, slug: "alh-1", outcome: "done", score: 20, feedback: "Completed before UXDA Learn" }).success,
    ).toBe(true);
  });

  it("needs feedback for changes requested, and a whole, non-negative score", () => {
    const res = importInputSchema.safeParse({ userId: USER, slug: "alh-1", outcome: "changes_requested", score: 5, feedback: "  " });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].path).toEqual(["feedback"]);
    expect(importInputSchema.safeParse({ userId: USER, slug: "alh-1", outcome: "done", score: -1, feedback: "" }).success).toBe(false);
    expect(importInputSchema.safeParse({ userId: USER, slug: "alh-1", outcome: "done", score: 1.5, feedback: "" }).success).toBe(false);
    expect(importInputSchema.safeParse({ userId: "x", slug: "alh-1", outcome: "done", score: 1, feedback: "" }).success).toBe(false);
  });
});

describe("importBlocker (mirrors import_submission)", () => {
  const base = { pathStatus: "published", milestoneStatus: "published", points: 20, attempts: [] };
  const a = (attempt: number, status: "submitted" | "published" | "needs_resubmission", final_score: number | null) => ({
    attempt,
    status,
    final_score,
    max_score: 20,
  });

  it("allows a first import", () => expect(importBlocker(base)).toBeNull());
  it("needs the path and milestone published", () => {
    expect(importBlocker({ ...base, pathStatus: "draft" })).toBe("Publish the path first.");
    expect(importBlocker({ ...base, milestoneStatus: "draft" })).toBe("Publish the path first.");
  });
  it("refuses while awaiting review, after 3 attempts, at full points and above the points", () => {
    expect(importBlocker({ ...base, attempts: [a(1, "submitted", null)] })).toBe("An attempt is awaiting review.");
    expect(importBlocker({ ...base, attempts: [a(1, "needs_resubmission", 1), a(2, "needs_resubmission", 1), a(3, "published", 5)] })).toBe(
      "All 3 attempts are used.",
    );
    expect(importBlocker({ ...base, attempts: [a(1, "published", 20)] })).toBe("Already at full points.");
    expect(importBlocker({ ...base, score: 21 })).toBe("The score can be at most 20.");
  });
  it("allows an import over a lower score (best one counts)", () => {
    expect(importBlocker({ ...base, attempts: [a(1, "published", 12)] })).toBeNull();
  });
});

describe("planImport", () => {
  const ms = ["m1", "m2", "m3"];
  const ctx = {
    path: { slug: "p", status: "published", milestones: ms },
    milestones: ms.map((slug, i) => ({ slug, status: "published", points: i === 2 ? 40 : 20 })),
    users: [
      { id: "u-ann", email: "Ann@uxdesignagency.com" },
      { id: "u-bo", email: "bo@uxdesignagency.com" },
    ],
    attempts: [] as Parameters<typeof planImport>[1]["attempts"],
  };
  const file = (users: ImportFile["users"]): ImportFile => ({ path: "p", note: "Completed before UXDA Learn", users });
  const done = (milestone: string, score: number, note?: string) => ({ milestone, status: "done" as const, score, note });

  it("imports each entry with the file's note, or the entry's own", () => {
    const { steps, errors } = planImport(
      file([{ email: "ann@uxdesignagency.com", milestones: [done("m1", 20), done("m2", 20), done("m3", 36, "Needs updates — see review in Figma.")] }]),
      ctx,
    );
    expect(errors).toEqual([]);
    expect(steps).toEqual([
      { kind: "import", email: "ann@uxdesignagency.com", userId: "u-ann", slug: "m1", outcome: "done", score: 20, feedback: "Completed before UXDA Learn" },
      { kind: "import", email: "ann@uxdesignagency.com", userId: "u-ann", slug: "m2", outcome: "done", score: 20, feedback: "Completed before UXDA Learn" },
      { kind: "import", email: "ann@uxdesignagency.com", userId: "u-ann", slug: "m3", outcome: "done", score: 36, feedback: "Needs updates — see review in Figma." },
    ]);
  });

  it("skips people who haven't signed in, empty entries, and milestones already imported (so a re-run does nothing)", () => {
    const { steps } = planImport(
      file([
        { email: "new@uxdesignagency.com", milestones: [done("m1", 20)] },
        { email: "bo@uxdesignagency.com", milestones: [] },
        { email: "ann@uxdesignagency.com", milestones: [done("m1", 20), done("m2", 20)] },
      ]),
      { ...ctx, attempts: [{ user_id: "u-ann", challenge_slug: "m1", attempt: 1, status: "published", final_score: 20, max_score: 20, is_imported: true }] },
    );
    expect(steps.map((s) => (s.kind === "skip" ? `${s.email} ${s.slug ?? ""}: ${s.reason}` : `import ${s.slug}`))).toEqual([
      "new@uxdesignagency.com : hasn't signed in to UXDA Learn yet",
      "bo@uxdesignagency.com : nothing to import",
      "ann@uxdesignagency.com m1: already imported",
      "import m2",
    ]);
  });

  it("skips a milestone the user already completed in the app at full points", () => {
    const { steps } = planImport(file([{ email: "bo@uxdesignagency.com", milestones: [done("m1", 20)] }]), {
      ...ctx,
      attempts: [{ user_id: "u-bo", challenge_slug: "m1", attempt: 1, status: "published", final_score: 20, max_score: 20, is_imported: false }],
    });
    expect(steps).toEqual([{ kind: "skip", email: "bo@uxdesignagency.com", slug: "m1", reason: "Already at full points." }]);
  });

  it("stops on entries out of path order, scores above the points, duplicates or a missing path", () => {
    expect(planImport(file([{ email: "ann@uxdesignagency.com", milestones: [done("m2", 20)] }]), ctx).errors).toEqual([
      'ann@uxdesignagency.com: entry 1 is "m2", but milestone 1 of the path is "m1".',
    ]);
    expect(planImport(file([{ email: "ann@uxdesignagency.com", milestones: [done("m1", 25)] }]), ctx).errors).toEqual([
      "ann@uxdesignagency.com: m1 score 25 is more than its 20 points.",
    ]);
    const twice = file([
      { email: "ann@uxdesignagency.com", milestones: [] },
      { email: "ann@uxdesignagency.com", milestones: [] },
    ]);
    expect(planImport(twice, ctx).errors).toEqual(["ann@uxdesignagency.com is listed twice."]);
    expect(planImport(file([]), { ...ctx, path: null }).errors[0]).toMatch(/No path "p"/);
  });

  it("refuses everything while the path is a draft", () => {
    const { steps } = planImport(file([{ email: "ann@uxdesignagency.com", milestones: [done("m1", 20)] }]), {
      ...ctx,
      path: { ...ctx.path, status: "draft" },
    });
    expect(steps).toEqual([{ kind: "skip", email: "ann@uxdesignagency.com", slug: "m1", reason: "Publish the path first." }]);
  });
});

describe("data/auto-layout-import.json", () => {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data/auto-layout-import.json"), "utf8"));
  const parsed = importFileSchema.parse(raw);
  const { content } = loadAndValidate(path.join(ROOT, "content"));
  const pathFile = content.paths.find((p) => p.data.slug === parsed.path)!;
  const points = new Map(content.challenges.map((c) => [c.data.slug, c.data.points ?? 0]));

  it("lists the milestones in path order with scores within their points", () => {
    expect(pathFile).toBeDefined();
    for (const u of parsed.users) {
      u.milestones.forEach((m, i) => {
        expect(m.milestone).toBe(pathFile.data.milestones[i]);
        expect(m.score).toBeLessThanOrEqual(points.get(m.milestone)!);
      });
    }
  });

  it("matches what was asked: Deniss's Final Boss is done at 9/10 with feedback (36/40 before the points change)", () => {
    const count = Object.fromEntries(parsed.users.map((u) => [u.email.split("@")[0], u.milestones.length]));
    expect(count).toEqual({ kristine: 7, "roberts.ceruss": 7, deniss: 7, tamara: 4, inese: 2, elina: 1, zanna: 0, alvis: 6 });
    const boss = parsed.users.find((u) => u.email.startsWith("deniss"))!.milestones[6];
    expect(boss).toEqual({ milestone: "alh-7-final-boss", status: "done", score: 9, note: "Needs updates — see review in Figma." });
    const others = parsed.users.flatMap((u) => u.milestones).filter((m) => m !== boss);
    expect(others.every((m) => m.status === "done" && m.score === points.get(m.milestone))).toBe(true);
  });
});
