import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import matter from "gray-matter";
import { briefView } from "./brief";

const DIR = path.resolve(__dirname, "../../../content/challenges");
const wf = readdirSync(DIR).filter((f) => /^wf-\d/.test(f));

/**
 * The meta row already shows the time, so wireframing briefs don't repeat it, and their first paragraph (all a
 * learner sees once they've started) is the task itself: the savings-goal brief.
 */
describe("wireframing briefs", () => {
  it("finds wf-1 to wf-6", () => {
    expect(wf).toHaveLength(6);
  });

  for (const file of wf) {
    const { data, content } = matter(readFileSync(path.join(DIR, file), "utf8"));
    it(`${file}: no Time line, and the first paragraph is the savings-goal brief`, () => {
      expect(content).not.toMatch(/\*\*Time:\*\*/);
      const { first } = briefView(content, data.title as string);
      expect(first).toMatch(/^\*\*The brief:\*\* a banking app wants a (\*\*)?savings goal(\*\*)? screen\./);
    });
  }
});
