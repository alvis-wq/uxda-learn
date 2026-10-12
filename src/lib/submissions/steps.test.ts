import { describe, expect, it } from "vitest";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { clampStep, emptyValues, furthestStep, isComplete, planSteps, stepForField, stepProblems, type FormValues } from "./steps";

const USER = "11111111-1111-4111-8111-111111111111";
const IMG = (n: number) => `${USER}/demo/${String(n).repeat(8)}-1111-4111-8111-111111111111.png`;

const single = (id: string): PublicQuestion => ({
  id,
  kind: "single",
  prompt: `Prompt ${id}`,
  points: 2,
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
});
const multi = (id: string): PublicQuestion => ({
  id,
  kind: "multi",
  prompt: `Prompt ${id}`,
  points: 2,
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
});
const text = (id: string, min_words?: number): PublicQuestion => ({ id, kind: "text", prompt: `Prompt ${id}`, points: 2, min_words });

const shots: SubmissionSpec = { screenshots: { min: 1, max: 2, label: "Shots" } };
const full: SubmissionSpec = {
  screenshots: { min: 1, max: 2, label: "Shots" },
  figma_url: { required: true, label: "Figma" },
  reflection: { required: true, min_words: 3, prompt: "Why?" },
};
const challenge = (questions: PublicQuestion[], spec: SubmissionSpec) => ({ slug: "demo", questions, submission_spec: spec });
const ids = (c: ReturnType<typeof challenge>) => planSteps(c).steps.map((s) => s.id);

describe("planSteps", () => {
  it("quiz: one step per question, then Review", () => {
    const plan = planSteps(challenge([single("q1"), multi("q2"), single("q3")], {}));
    expect(plan.mode).toBe("quiz");
    expect(plan.steps.map((s) => s.title)).toEqual(["Question 1", "Question 2", "Question 3", "Review"]);
    expect(plan.steps[0]).toMatchObject({ id: "q:q1", kind: "question", questionId: "q1" });
    expect(plan.steps.at(-1)).toMatchObject({ kind: "review" });
  });

  it("mixed: steps in order, only those that apply", () => {
    expect(ids(challenge([text("t1")], full))).toEqual(["brief", "questions", "screenshots", "figma", "reflection", "review"]);
    expect(ids(challenge([], full))).toEqual(["brief", "screenshots", "figma", "reflection", "review"]);
    expect(ids(challenge([], { ...shots, reflection: full.reflection }))).toEqual(["brief", "screenshots", "reflection", "review"]);
    expect(ids(challenge([single("q1"), single("q2")], shots))).toEqual(["brief", "questions", "screenshots", "review"]);
    expect(planSteps(challenge([], full)).steps.at(-1)?.title).toBe("Review & submit");
  });

  it("single-step challenges keep the plain layout", () => {
    expect(planSteps(challenge([single("q1")], {})).mode).toBe("single");
    expect(planSteps(challenge([], { reflection: full.reflection })).mode).toBe("single");
    expect(planSteps(challenge([], shots)).mode).toBe("single");
    expect(planSteps(challenge([text("t1"), text("t2")], {})).mode).toBe("single"); // all in one place
    expect(planSteps(challenge([], {})).mode).toBe("single");
  });
});

describe("stepProblems", () => {
  const values = (over: Partial<FormValues> = {}): FormValues => ({ ...emptyValues, ...over });

  it("quiz: a step is blocked until its question has an answer", () => {
    const c = challenge([single("q1"), multi("q2")], {});
    const plan = planSteps(c);
    expect(stepProblems(plan, c, USER, values())).toEqual({ "q:q1": "Choose an answer.", "q:q2": "Choose at least one option." });
    const some = stepProblems(plan, c, USER, values({ answers: { q1: "a" } }));
    expect(some).toEqual({ "q:q2": "Choose at least one option." });
    expect(isComplete(plan, some)).toBe(false);
    const done = stepProblems(plan, c, USER, values({ answers: { q1: "a", q2: ["a", "b"] } }));
    expect(done).toEqual({});
    expect(isComplete(plan, done)).toBe(true);
  });

  it("mixed: questions, screenshots, Figma and reflection each report why they are blocked", () => {
    const c = challenge([text("t1", 3)], full);
    const plan = planSteps(c);
    const p = stepProblems(plan, c, USER, values({ answers: { t1: "two words" }, figmaUrl: "https://example.com/x", reflection: "too short" }));
    expect(p.questions).toBe("Question 1: Write at least 3 words.");
    expect(p.screenshots).toBe("Upload at least 1 screenshot(s).");
    expect(p.figma).toBe("Use an https://www.figma.com/… link.");
    expect(p.reflection).toBe("Write at least 3 words.");
    expect(p.brief).toBeUndefined();
  });

  it("mixed: counts further unanswered questions", () => {
    const c = challenge([text("t1"), single("q2"), single("q3")], shots);
    const p = stepProblems(planSteps(c), c, USER, values());
    expect(p.questions).toBe("Question 1: Write an answer. (2 more to go)");
  });

  it("is satisfied by valid values, and optional fields may stay empty", () => {
    const c = challenge([], { screenshots: shots.screenshots, figma_url: { required: false, label: "Figma" }, reflection: { required: false, prompt: "Why?" } });
    const plan = planSteps(c);
    const p = stepProblems(plan, c, USER, values({ images: [{ path: IMG(1) }] }));
    expect(p).toEqual({});
    expect(isComplete(plan, p)).toBe(true);
    // ...but anything typed in an optional field still has to be valid.
    expect(stepProblems(plan, c, USER, values({ images: [{ path: IMG(1) }], figmaUrl: "nope" })).figma).toBeDefined();
  });

  it("blocks the screenshots step while an upload is still running", () => {
    const c = challenge([], full);
    const p = stepProblems(planSteps(c), c, USER, values({ images: [{ path: IMG(1) }], uploading: true }));
    expect(p.screenshots).toBe("Waiting for your screenshots to finish uploading.");
  });

  it("rejects screenshot paths that aren't the user's own", () => {
    const c = challenge([], full);
    const p = stepProblems(planSteps(c), c, USER, values({ images: [{ path: "someone-else/demo/x.png" }] }));
    expect(p.screenshots).toBe("Invalid screenshot upload.");
  });
});

describe("step navigation", () => {
  const c = challenge([single("q1"), single("q2"), single("q3")], {});
  const plan = planSteps(c);

  it("can't skip past the first step that isn't valid", () => {
    const p = { "q:q2": "Choose an answer.", "q:q3": "Choose an answer." };
    expect(furthestStep(plan, p)).toBe(2);
    expect(clampStep(plan, p, 4)).toBe(2);
    expect(clampStep(plan, p, 1)).toBe(1);
    expect(clampStep(plan, p, 0)).toBe(1);
  });

  it("reaches Review when everything is valid", () => {
    expect(furthestStep(plan, {})).toBe(4);
    expect(clampStep(plan, {}, 99)).toBe(4);
  });

  it("maps server field errors to steps", () => {
    expect(stepForField(plan, "answers.q2")).toBe("q:q2");
    const mixed = planSteps(challenge([text("t1")], full));
    expect(stepForField(mixed, "answers.t1")).toBe("questions");
    expect(stepForField(mixed, "imagePaths")).toBe("screenshots");
    expect(stepForField(mixed, "figmaUrl")).toBe("figma");
    expect(stepForField(mixed, "reflection")).toBe("reflection");
    expect(stepForField(mixed, "form")).toBe("review");
  });
});
