import { describe, expect, it } from "vitest";
import { countStates, isOverdue, requiredFirst, requiredState, sortByUrgency } from "./required";

const now = new Date("2026-10-09T12:00:00Z");
const past = "2026-10-01T09:00:00Z";
const future = "2026-10-20T09:00:00Z";

describe("requiredState", () => {
  it("done wins over everything, even past the due date", () => {
    expect(requiredState({ done: true, latestStatus: "needs_resubmission", dueAt: past, now })).toBe("done");
  });

  it("awaiting review is pending (the learner can't act), even past the due date", () => {
    expect(requiredState({ done: false, latestStatus: "submitted", dueAt: future, now })).toBe("pending");
    expect(requiredState({ done: false, latestStatus: "ai_reviewed", dueAt: past, now })).toBe("pending");
  });

  it("resubmission requested is missing, and becomes overdue after the due date", () => {
    expect(requiredState({ done: false, latestStatus: "needs_resubmission", dueAt: future, now })).toBe("missing");
    expect(requiredState({ done: false, latestStatus: "needs_resubmission", dueAt: null, now })).toBe("missing");
    expect(requiredState({ done: false, latestStatus: "needs_resubmission", dueAt: past, now })).toBe("overdue");
  });

  it("not started is missing, or overdue once the due date has passed", () => {
    expect(requiredState({ done: false, latestStatus: null, dueAt: null, now })).toBe("missing");
    expect(requiredState({ done: false, latestStatus: null, dueAt: future, now })).toBe("missing");
    expect(requiredState({ done: false, latestStatus: null, dueAt: past, now })).toBe("overdue");
  });

  it("isOverdue", () => {
    expect(isOverdue(past, false, now)).toBe(true);
    expect(isOverdue(past, true, now)).toBe(false);
    expect(isOverdue(future, false, now)).toBe(false);
    expect(isOverdue(null, false, now)).toBe(false);
  });
});

describe("ordering", () => {
  it("requiredFirst keeps the order within each group", () => {
    const items = [
      { id: "a", required: false },
      { id: "b", required: true },
      { id: "c", required: false },
      { id: "d", required: true },
    ];
    expect(requiredFirst(items).map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("sortByUrgency: overdue, then due date (undated last), then title", () => {
    const items = [
      { title: "Z undated", due_at: null, requiredState: "missing" as const },
      { title: "Later", due_at: "2026-11-01T00:00:00Z", requiredState: "missing" as const },
      { title: "Overdue", due_at: past, requiredState: "overdue" as const },
      { title: "A undated", due_at: null, requiredState: "missing" as const },
      { title: "In review", due_at: null, requiredState: "pending" as const },
      { title: "Soon", due_at: future, requiredState: "missing" as const },
    ];
    expect(sortByUrgency(items).map((i) => i.title)).toEqual([
      "Overdue",
      "Soon",
      "Later",
      "A undated",
      "Z undated",
      "In review",
    ]);
  });

  it("countStates", () => {
    expect(countStates(["done", "overdue", "done", "pending"])).toEqual({ done: 2, pending: 1, missing: 0, overdue: 1 });
  });
});
