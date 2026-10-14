import { describe, expect, it } from "vitest";
import { isChallengeVisible } from "@/lib/challenges/model";
import { isTestChallenge, nextTestAttempt, showsTestTotal, testingState } from "./testing";

const attempt = (n: number, status: "published" | "submitted" = "published", score: number | null = 4) => ({
  attempt: n, status, final_score: score, max_score: 4,
});

describe("testingState", () => {
  it("never limits a tester: past 3 attempts, after full marks", () => {
    const many = [1, 2, 3, 4, 5].map((n) => attempt(n, "published", 4));
    expect(testingState(many)).toMatchObject({ canSubmit: true, reason: null, attemptsUsed: 5, bestScore: null });
  });

  it("has no best score and starts clean", () => {
    expect(testingState([])).toEqual({ attemptsUsed: 0, latest: null, bestScore: null, canSubmit: true, reason: null });
  });

  it("the latest attempt is the highest number", () => {
    expect(testingState([attempt(2), attempt(1), attempt(3)]).latest?.attempt).toBe(3);
  });
});

describe("nextTestAttempt", () => {
  it("counts on from the highest attempt number", () => {
    expect(nextTestAttempt([])).toBe(1);
    expect(nextTestAttempt([{ attempt: 1 }, { attempt: 2 }, { attempt: 3 }])).toBe(4);
    expect(nextTestAttempt([{ attempt: 5 }, { attempt: 2 }])).toBe(6);
  });
});

describe("isTestChallenge / showsTestTotal", () => {
  it("only a draft is tried as a test", () => {
    expect(isTestChallenge("draft")).toBe(true);
    expect(isTestChallenge("published")).toBe(false);
    expect(isTestChallenge("archived")).toBe(false);
  });
  it("shows a total only when everything on the challenge is auto-graded", () => {
    expect(showsTestTotal(false)).toBe(true);
    expect(showsTestTotal(true)).toBe(false);
  });
});

describe("who can open a draft (app-side twin of the challenges_select policy)", () => {
  const cat = (audiences: ("all" | "designer" | "strategist")[], archived = false) => ({ archived, audiences });
  const draft = (audiences: ("all" | "designer" | "strategist")[]) => ({ status: "draft", audiences });

  it("a tester sees a draft their track can see", () => {
    expect(isChallengeVisible(draft(["all"]), cat(["all"]), "designer", true)).toBe(true);
    expect(isChallengeVisible(draft(["designer"]), cat(["designer"]), "designer", true)).toBe(true);
  });
  it("a non-tester never does", () => {
    expect(isChallengeVisible(draft(["all"]), cat(["all"]), "designer")).toBe(false);
    expect(isChallengeVisible(draft(["all"]), cat(["all"]), "designer", false)).toBe(false);
  });
  it("not when the challenge or its category is aimed at another track, or the category is archived", () => {
    expect(isChallengeVisible(draft(["strategist"]), cat(["all"]), "designer", true)).toBe(false);
    expect(isChallengeVisible(draft(["all"]), cat(["strategist"]), "designer", true)).toBe(false);
    expect(isChallengeVisible(draft(["all"]), cat(["all"], true), "designer", true)).toBe(false);
    expect(isChallengeVisible(draft(["all"]), null, "designer", true)).toBe(false);
  });
  it("archived stays hidden from testers", () => {
    expect(isChallengeVisible({ status: "archived", audiences: ["all"] }, cat(["all"]), "designer", true)).toBe(false);
  });
  it("published is unchanged for everyone", () => {
    expect(isChallengeVisible({ status: "published", audiences: ["all"] }, cat(["all"]), "designer", false)).toBe(true);
    expect(isChallengeVisible({ status: "published", audiences: ["all"] }, cat(["all"]), "designer", true)).toBe(true);
  });
});
