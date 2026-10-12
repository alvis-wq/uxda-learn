import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { LOGIN_SEQ, LOGIN_SEQ_END_MS, LOGIN_X_DISTANCE } from "./login-sequence";

describe("login sequence timeline", () => {
  it("matches the spec: big X, ease down at 1.2s over 0.6s, card at 1.8s over 0.5s, X out at 2.3s over 0.6s", () => {
    expect(LOGIN_SEQ).toMatchObject({
      startZoom: 1.6,
      zoomAtMs: 1200,
      zoomMs: 600,
      cardAtMs: 1800,
      cardMs: 500,
      xFadeAtMs: 2300,
      xFadeMs: 600,
    });
    expect(LOGIN_SEQ_END_MS).toBe(2900);
  });

  it("is ordered: the X has settled before the card appears, and the card is up before the X leaves", () => {
    expect(LOGIN_SEQ.zoomAtMs + LOGIN_SEQ.zoomMs).toBeLessThanOrEqual(LOGIN_SEQ.cardAtMs);
    expect(LOGIN_SEQ.cardAtMs + LOGIN_SEQ.cardMs).toBeLessThanOrEqual(LOGIN_SEQ.xFadeAtMs + LOGIN_SEQ.xFadeMs);
    expect(LOGIN_SEQ.cardAtMs).toBeLessThan(LOGIN_SEQ.xFadeAtMs);
  });

  it("gives up on the X after ~1 s and keeps the no-JS safety net well after the sequence ends", () => {
    expect(LOGIN_SEQ.readyTimeoutMs).toBeLessThanOrEqual(1000);
    expect(LOGIN_SEQ.cardFailsafeMs).toBeGreaterThan(LOGIN_SEQ_END_MS);
  });

  it("moves the camera in for the start zoom (distance is the zoom-1, final-size distance)", () => {
    expect(LOGIN_X_DISTANCE / LOGIN_SEQ.startZoom).toBeLessThan(LOGIN_X_DISTANCE);
  });

  it("keeps no \"already played\" state: nothing stores or reads the old login-sequence cookie", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const sources = walk(path.resolve(__dirname, "..")).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    const offenders = sources.filter((f) => /uxda_login_seq|LOGIN_SEQ_COOKIE|loginSequenceInitial/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    // the separate post-login loader still has its own state
    expect(readFileSync(path.resolve(__dirname, "intro.ts"), "utf8")).toContain("uxda_intro");
  });
});
