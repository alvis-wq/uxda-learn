import { describe, expect, it } from "vitest";
import { buildTeamAcademy } from "./academy";

describe("buildTeamAcademy", () => {
  const input = {
    members: [
      { id: "u1", full_name: "Inese" },
      { id: "u2", full_name: "Arita" },
      { id: "u3", full_name: null },
    ],
    resources: [
      { id: "b1", kind: "blog", title: "Post 1", sort_key: 1 },
      { id: "b2", kind: "blog", title: "Post 2", sort_key: 2 },
      { id: "p1", kind: "podcast", title: "Ep 1", sort_key: 1 },
      { id: "k1", kind: "book", title: "Book", sort_key: 1 },
    ],
    completions: [
      { user_id: "u1", resource_id: "b1", completed_at: "2026-01-01T00:00:00Z", is_imported: true },
      { user_id: "u1", resource_id: "b2", completed_at: "2026-10-20T00:00:00Z", is_imported: false },
      { user_id: "u1", resource_id: "k1", completed_at: "2026-10-01T00:00:00Z", is_imported: false },
      { user_id: "u2", resource_id: "b1", completed_at: "2026-02-01T00:00:00Z", is_imported: true },
      { user_id: "u2", resource_id: "gone", completed_at: "2026-02-01T00:00:00Z", is_imported: false },
      { user_id: "stranger", resource_id: "b1", completed_at: "2026-02-01T00:00:00Z", is_imported: false },
    ],
    reading: [
      { user_id: "u2", resource_id: "k1", started_at: "2026-11-01T00:00:00Z" },
      { user_id: "u3", resource_id: "k1", started_at: "2026-11-02T00:00:00Z" },
      { user_id: "u1", resource_id: "k1", started_at: "2026-09-01T00:00:00Z" }, // finished since: not reading
      { user_id: "u2", resource_id: "gone", started_at: "2026-11-01T00:00:00Z" },
      { user_id: "stranger", resource_id: "k1", started_at: "2026-11-01T00:00:00Z" },
    ],
  };

  it("counts per person and kind, ignoring unpublished resources and unknown people", () => {
    const { people, totals } = buildTeamAcademy(input);
    expect(totals).toEqual({ blog: 2, podcast: 1, book: 1 });
    expect(people.map((p) => [p.name, p.done, p.last])).toEqual([
      ["Inese", { blog: 2, podcast: 0, book: 1 }, "2026-10-20T00:00:00Z"],
      ["Arita", { blog: 1, podcast: 0, book: 0 }, null], // imported completions don't count as "last active"
      ["Unnamed", { blog: 0, podcast: 0, book: 0 }, null],
    ]);
  });

  it("lists who completed each resource", () => {
    const { byResource } = buildTeamAcademy(input);
    expect(byResource.find((r) => r.id === "b1")?.doneBy).toEqual(["Arita", "Inese"]);
    expect(byResource.find((r) => r.id === "p1")?.doneBy).toEqual([]);
  });

  it("shows who is reading which published book, leaving out books they've finished", () => {
    const { people, byResource } = buildTeamAcademy(input);
    expect(people.map((p) => [p.name, p.reading])).toEqual([
      ["Inese", []],
      ["Arita", ["Book"]],
      ["Unnamed", ["Book"]],
    ]);
    expect(byResource.find((r) => r.id === "k1")?.readingBy).toEqual(["Arita", "Unnamed"]);
  });
});
