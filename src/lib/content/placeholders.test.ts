import { describe, expect, it } from "vitest";
import { challengeParts, describePlaceholders, findPlaceholders } from "./placeholders";

describe("findPlaceholders", () => {
  it("finds TODO markers in nested content, once per token and location", () => {
    const hits = findPlaceholders(
      challengeParts({
        title: "Spot the plant",
        body: "Open TODO_FIGMA_URL. Then TODO_FIGMA_URL again.",
        questions: [{ prompt: "Fine" }, { options: [{ label: "See TODO" }] }],
        submission: { figma_url: { label: "Link" } },
        rubric: [],
        grader_notes: "TODO_FIGMA_URL — Alvis provides the file.",
      }),
    );
    expect(hits).toEqual([
      { token: "TODO_FIGMA_URL", where: "brief" },
      { token: "TODO", where: "questions" },
      { token: "TODO_FIGMA_URL", where: "grader notes" },
    ]);
    expect(describePlaceholders(hits)).toBe("TODO_FIGMA_URL (brief, grader notes); TODO (questions)");
  });

  it("ignores ordinary prose and lower-case todo", () => {
    expect(
      findPlaceholders({ brief: "Make a todo list. TODOS and MYTODO aren't markers; Todo isn't either." }),
    ).toEqual([]);
  });

  it("handles empty parts", () => {
    expect(findPlaceholders(challengeParts({ title: "x", body: "y", summary: null, grader_notes: null }))).toEqual([]);
  });
});
