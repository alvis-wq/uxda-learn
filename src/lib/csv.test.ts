import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("neutralises formula injection but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-3")).toBe("-3");
    expect(csvCell(-2.5)).toBe("-2.5");
  });
  it("renders null/undefined as empty and joins rows with CRLF", () => {
    expect(toCsv([["a", null, undefined, 1]])).toBe("a,,,1\r\n");
  });
});
