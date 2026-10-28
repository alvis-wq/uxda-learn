import { describe, expect, it } from "vitest";
import { PAGE_SIZE, allRows } from "./all-rows";

describe("allRows", () => {
  const table = Array.from({ length: PAGE_SIZE * 2 + 5 }, (_, i) => i);
  const page = (from: number, to: number) => Promise.resolve({ data: table.slice(from, to + 1), error: null });

  it("reads page after page until a short one", async () => {
    const calls: number[] = [];
    const res = await allRows((from, to) => (calls.push(from), page(from, to)));
    expect(res.data).toEqual(table);
    expect(calls).toEqual([0, PAGE_SIZE, PAGE_SIZE * 2]);
  });

  it("stops at an error and returns it", async () => {
    const res = await allRows((from, to) => (from === 0 ? page(from, to) : Promise.resolve({ data: null, error: { message: "boom" } })));
    expect(res.error?.message).toBe("boom");
    expect(res.data).toHaveLength(PAGE_SIZE);
  });
});
