import { describe, expect, it } from "vitest";
import type { Audience, Challenge } from "@/lib/challenges/model";
import { challengeNeedsReview, isChallengeVisible } from "@/lib/challenges/model";
import { gradeAnswers } from "./grading";
import { countWords, isFigmaUrl, isOwnImagePath, submissionInputSchema } from "./input";
import { attemptState, isResultVisible, learnerStatus } from "./rules";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const IMG = "33333333-3333-4333-8333-333333333333";

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    slug: "c1", category_slug: "cat", title: "C1", summary: null, body_md: "b", type: "quiz",
    audiences: ["all"], required_for: [], difficulty: 1, points: 10, estimated_minutes: null, version: 1,
    content_hash: "h", status: "published", due_at: null, updated_at: "", image: null,
    questions: [
      { id: "q1", kind: "single", prompt: "p", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], points: 4 },
      { id: "q2", kind: "multi", prompt: "p", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }], points: 6 },
    ],
    submission_spec: {},
    rubric: [],
    ...over,
  };
}

const reviewChallenge = challenge({
  type: "mixed",
  questions: [{ id: "t1", kind: "text", prompt: "p", min_words: 3, points: 5 }],
  submission_spec: {
    screenshots: { min: 1, max: 2, label: "s" },
    figma_url: { required: false, label: "f" },
    reflection: { required: true, min_words: 4, prompt: "r" },
  },
});

describe("gradeAnswers", () => {
  const key = { q1: "b", q2: ["a", "c"] };
  it("scores correct single and multi answers", () => {
    expect(gradeAnswers(challenge().questions, key, { q1: "b", q2: ["c", "a"] }).autoScore).toBe(10);
  });
  it("multi is all-or-nothing", () => {
    expect(gradeAnswers(challenge().questions, key, { q1: "b", q2: ["a"] }).autoScore).toBe(4);
    expect(gradeAnswers(challenge().questions, key, { q1: "b", q2: ["a", "b", "c"] }).autoScore).toBe(4);
  });
  it("wrong or missing answers score 0", () => {
    expect(gradeAnswers(challenge().questions, key, { q1: "a" }).autoScore).toBe(0);
  });
  it("ignores text questions", () => {
    expect(gradeAnswers(reviewChallenge.questions, {}, { t1: "anything" }).autoScore).toBe(0);
  });
});

describe("submissionInputSchema", () => {
  const quiz = submissionInputSchema(challenge(), USER);
  const ok = { answers: { q1: "a", q2: ["b"] }, imagePaths: [], figmaUrl: null, reflection: null };

  it("accepts a complete quiz answer", () => {
    expect(quiz.safeParse(ok).success).toBe(true);
  });
  it("rejects unknown option ids, missing answers and extra questions", () => {
    expect(quiz.safeParse({ ...ok, answers: { q1: "z", q2: ["b"] } }).success).toBe(false);
    expect(quiz.safeParse({ ...ok, answers: { q1: "a" } }).success).toBe(false);
    expect(quiz.safeParse({ ...ok, answers: { ...ok.answers, q9: "a" } }).success).toBe(false);
    expect(quiz.safeParse({ ...ok, answers: { q1: "a", q2: [] } }).success).toBe(false);
  });
  it("rejects screenshots, figma and reflection on a quiz", () => {
    expect(quiz.safeParse({ ...ok, imagePaths: [`${USER}/c1/${IMG}.png`] }).success).toBe(false);
    expect(quiz.safeParse({ ...ok, figmaUrl: "https://www.figma.com/file/x" }).success).toBe(false);
    expect(quiz.safeParse({ ...ok, reflection: "hello there my friend" }).success).toBe(false);
  });

  const review = submissionInputSchema(reviewChallenge, USER);
  const good = {
    answers: { t1: "one two three" },
    imagePaths: [`${USER}/c1/${IMG}.png`],
    figmaUrl: "",
    reflection: "four words right here",
  };
  it("accepts a complete review submission", () => {
    const r = review.safeParse(good);
    expect(r.success).toBe(true);
    expect(r.data?.figmaUrl).toBeNull();
  });
  it("enforces min words, screenshot count and reflection", () => {
    expect(review.safeParse({ ...good, answers: { t1: "two words" } }).success).toBe(false);
    expect(review.safeParse({ ...good, imagePaths: [] }).success).toBe(false);
    expect(review.safeParse({ ...good, reflection: "" }).success).toBe(false);
    expect(review.safeParse({ ...good, reflection: "too short" }).success).toBe(false);
  });
  it("rejects images outside the user's own challenge folder", () => {
    expect(review.safeParse({ ...good, imagePaths: [`${OTHER}/c1/${IMG}.png`] }).success).toBe(false);
    expect(review.safeParse({ ...good, imagePaths: [`${USER}/other/${IMG}.png`] }).success).toBe(false);
    expect(review.safeParse({ ...good, imagePaths: [`${USER}/c1/../x/${IMG}.png`] }).success).toBe(false);
    expect(review.safeParse({ ...good, imagePaths: [`${USER}/c1/${IMG}.gif`] }).success).toBe(false);
  });
  it("only accepts https figma.com links", () => {
    expect(review.safeParse({ ...good, figmaUrl: "https://www.figma.com/design/abc?node-id=1-2" }).success).toBe(true);
    expect(review.safeParse({ ...good, figmaUrl: "http://www.figma.com/design/abc" }).success).toBe(false);
    expect(review.safeParse({ ...good, figmaUrl: "https://figma.com.evil.com/x" }).success).toBe(false);
    expect(review.safeParse({ ...good, figmaUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("countWords", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("isFigmaUrl / isOwnImagePath", () => {
    expect(isFigmaUrl("https://figma.com/file/x")).toBe(true);
    expect(isOwnImagePath(`${USER}/c1/${IMG}.jpg`, USER, "c1")).toBe(true);
  });
  it("needs review only when something isn't auto-gradable", () => {
    expect(challengeNeedsReview(challenge())).toBe(false);
    expect(challengeNeedsReview(reviewChallenge)).toBe(true);
  });
  it("challenge visibility needs published + category and challenge audiences", () => {
    const cat = (audiences: Audience[], archived = false) => ({ archived, audiences });
    const pub = (audiences: Audience[]) => ({ status: "published", audiences });
    const designers = cat(["designer", "motion_designer"]);
    expect(isChallengeVisible(pub(["all"]), designers, "motion_designer")).toBe(true);
    expect(isChallengeVisible(pub(["all"]), designers, "strategist")).toBe(false);
    expect(isChallengeVisible(pub(["designer"]), designers, "motion_designer")).toBe(false);
    expect(isChallengeVisible({ status: "draft", audiences: ["all"] }, cat(["all"]), "designer")).toBe(false);
    expect(isChallengeVisible(pub(["all"]), cat(["all"], true), "designer")).toBe(false);
    expect(isChallengeVisible(pub(["all"]), null, "designer")).toBe(false);
  });
});

describe("attemptState", () => {
  const a = (attempt: number, status: "submitted" | "ai_reviewed" | "published" | "needs_resubmission", score: number | null = null) => ({
    attempt, status, final_score: score, max_score: 10,
  });
  it("allows a first attempt", () => {
    expect(attemptState([])).toMatchObject({ attemptsUsed: 0, canSubmit: true, bestScore: null });
  });
  it("blocks while awaiting review (submitted or ai_reviewed)", () => {
    expect(attemptState([a(1, "submitted")]).canSubmit).toBe(false);
    expect(attemptState([a(1, "ai_reviewed", 7)]).canSubmit).toBe(false);
  });
  it("allows resubmission after needs_resubmission or a non-perfect published score", () => {
    expect(attemptState([a(1, "needs_resubmission")]).canSubmit).toBe(true);
    expect(attemptState([a(1, "published", 6)])).toMatchObject({ canSubmit: true, bestScore: 6 });
  });
  it("blocks after full points or 3 attempts, keeps the best score", () => {
    expect(attemptState([a(1, "published", 10)]).canSubmit).toBe(false);
    const s = attemptState([a(1, "published", 8), a(2, "published", 4), a(3, "needs_resubmission")]);
    expect(s).toMatchObject({ canSubmit: false, bestScore: 8, attemptsUsed: 3 });
  });
  it("hides AI results from learners until approved", () => {
    expect(learnerStatus("ai_reviewed").label).toBe("Awaiting review");
    expect(isResultVisible("ai_reviewed")).toBe(false);
    expect(isResultVisible("published")).toBe(true);
    expect(isResultVisible("needs_resubmission")).toBe(true);
  });
});
