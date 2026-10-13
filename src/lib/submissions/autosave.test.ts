import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autosaver, AUTOSAVE_DEBOUNCE_MS, type SaveOutcome, type SaveStatus } from "./autosave";

type Form = { step: number; text: string };
const base: Form = { step: 1, text: "" };

function setup(outcome: () => Promise<SaveOutcome> = async () => ({ ok: true })) {
  const sent: Form[] = [];
  const statuses: SaveStatus[] = [];
  const saver = new Autosaver<Form>(
    async (v) => (sent.push(v), outcome()),
    (s) => statuses.push(s),
    base,
  );
  return { saver, sent, statuses };
}

/** Let promises settle without moving the fake clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("Autosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves nothing when the form is as the server has it", async () => {
    const { saver, sent } = setup();
    saver.update(base);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 5);
    expect(sent).toEqual([]);
  });

  it("debounces: one save, of the latest state, a second after the last edit", async () => {
    const { saver, sent, statuses } = setup();
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(600);
    saver.update({ step: 1, text: "ab" });
    await vi.advanceTimersByTimeAsync(600);
    expect(sent).toEqual([]); // 600 ms since the last edit: still waiting
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 600);
    expect(sent).toEqual([{ step: 1, text: "ab" }]);
    expect(statuses).toEqual(["saving", "saved"]);
  });

  it("saves a step change at once, together with pending edits", async () => {
    const { saver, sent } = setup();
    saver.update({ step: 1, text: "typed" });
    saver.update({ step: 2, text: "typed" }, true);
    await settle();
    expect(sent).toEqual([{ step: 2, text: "typed" }]);
  });

  it("does not save the same state twice", async () => {
    const { saver, sent } = setup();
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 3);
    expect(sent).toHaveLength(1);
  });

  it("an edit while a save is in flight is saved after it, never concurrently", async () => {
    let release!: () => void;
    let calls = 0;
    const { saver, sent } = setup(() => {
      calls++;
      return calls === 1 ? new Promise((r) => (release = () => r({ ok: true }))) : Promise.resolve({ ok: true });
    });
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(sent).toHaveLength(1);
    saver.update({ step: 1, text: "ab" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(sent).toHaveLength(1); // the first is still in flight
    release();
    await settle();
    expect(sent).toEqual([{ step: 1, text: "a" }, { step: 1, text: "ab" }]);
  });

  it("flush sends what is pending now", async () => {
    const { saver, sent } = setup();
    saver.update({ step: 1, text: "leaving" });
    await saver.flush();
    expect(sent).toEqual([{ step: 1, text: "leaving" }]);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(sent).toHaveLength(1);
  });

  it("retries a failed save with a growing delay, and shows the error until it works", async () => {
    let fail = 2;
    const { saver, sent, statuses } = setup(async () => (fail-- > 0 ? { ok: false } : { ok: true }));
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(statuses.at(-1)).toBe("error");
    await vi.advanceTimersByTimeAsync(3999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); // 4 s: second attempt
    expect(sent).toHaveLength(2);
    expect(statuses.at(-1)).toBe("error");
    await vi.advanceTimersByTimeAsync(8000); // 8 s: third attempt succeeds
    expect(sent).toHaveLength(3);
    expect(statuses.at(-1)).toBe("saved");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sent).toHaveLength(3);
  });

  it("treats a thrown action like a failed one", async () => {
    let first = true;
    const { saver, sent, statuses } = setup(async () => {
      if (first) {
        first = false;
        throw new Error("network");
      }
      return { ok: true };
    });
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(statuses.at(-1)).toBe("error");
    await vi.advanceTimersByTimeAsync(4000);
    expect(sent).toHaveLength(2);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("stops for good when the challenge changed under the open page (stale)", async () => {
    const { saver, sent, statuses } = setup(async () => ({ ok: false, stale: true }));
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(statuses.at(-1)).toBe("stale");
    saver.update({ step: 1, text: "ab" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 10);
    expect(sent).toHaveLength(1);
  });

  it("pause cancels a pending save and waits for one in flight; resume carries on", async () => {
    let release!: () => void;
    const { saver, sent } = setup(() => new Promise((r) => (release = () => r({ ok: true }))));
    saver.update({ step: 1, text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    let paused = false;
    const waiting = saver.pause().then(() => (paused = true));
    await settle();
    expect(paused).toBe(false); // the save is still in flight
    release();
    await waiting;
    expect(paused).toBe(true);

    saver.update({ step: 1, text: "ab" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 3);
    expect(sent).toHaveLength(1); // paused: nothing more is sent
    saver.resume();
    saver.update({ step: 1, text: "abc" });
    release = () => {};
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(sent.at(-1)).toEqual({ step: 1, text: "abc" });
  });

  it("reset makes the cleared form the baseline: it is not saved back", async () => {
    const { saver, sent, statuses } = setup();
    saver.update({ step: 2, text: "a" });
    saver.reset(base);
    saver.update(base);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS * 3);
    expect(sent).toEqual([]);
    expect(statuses.at(-1)).toBe("idle");
  });
});
