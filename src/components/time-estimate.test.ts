import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { timeOf } from "@/lib/challenges/time";
import { TimeEstimate } from "./time-estimate";

const render = (estimated_minutes: number, waiting_minutes: number) =>
  renderToStaticMarkup(createElement(TimeEstimate, { time: timeOf({ estimated_minutes, waiting_minutes })! }));

describe("TimeEstimate waiting info", () => {
  it("puts a labelled info button right after the waiting value", () => {
    const html = render(20, 10);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/~10 min waiting <button[^>]*type="button"[^>]*aria-label="What is waiting time\?"/);
    expect(html).not.toMatch(/<a[\s>]/); // never inside a link: cards put it above their link instead
  });

  it("has no button without waiting time", () => {
    const html = render(20, 0);
    expect(html).toContain("~20 min");
    expect(html).not.toContain("<button");
  });
});
