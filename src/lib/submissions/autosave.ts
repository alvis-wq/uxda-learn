/** Pause after the last edit before it is saved. A step change is saved at once. */
export const AUTOSAVE_DEBOUNCE_MS = 1000;
const RETRY_BASE_MS = 4000;
const RETRY_MAX_MS = 30_000;

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "stale";
export type SaveOutcome = { ok: true } | { ok: false; stale?: boolean };

/**
 * The timing rules of draft autosave, free of React so they can be tested with fake timers:
 *  - an edit is saved after AUTOSAVE_DEBOUNCE_MS of quiet, a step change at once;
 *  - one save at a time, always of the latest state, and never of a state the server already holds;
 *  - `flush()` sends what is pending now (tab hidden, form unmounted);
 *  - a failed save is retried with a growing delay (and by the next edit); "stale" (the challenge changed under the
 *    open page) is final;
 *  - `pause()` stops saving and waits for a save in flight, so none can land after the submit that deletes the
 *    draft; `resume()` starts again; `reset()` makes a cleared form the new baseline ("Start over").
 * `initial` is what the server already holds, so opening a form saves nothing.
 */
export class Autosaver<T> {
  private latest: T;
  private saved: string;
  private inflight: Promise<void> | null = null;
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;

  constructor(
    private readonly send: (value: T) => Promise<SaveOutcome>,
    private readonly onStatus: (status: SaveStatus) => void,
    initial: T,
    private readonly debounceMs = AUTOSAVE_DEBOUNCE_MS,
  ) {
    this.latest = initial;
    this.saved = JSON.stringify(initial);
  }

  /** The form changed to `value`. `immediate`: save now rather than after the pause (a step change). */
  update(value: T, immediate = false): void {
    this.latest = value;
    if (this.paused || JSON.stringify(value) === this.saved) {
      this.clear();
      return;
    }
    this.clear();
    this.timer = setTimeout(() => void this.flush(), immediate ? 0 : this.debounceMs);
  }

  async flush(): Promise<void> {
    this.clear();
    while (this.inflight) await this.inflight;
    if (this.paused) return;
    const value = this.latest;
    const body = JSON.stringify(value);
    if (body === this.saved) return;

    this.onStatus("saving");
    const run = (async () => {
      try {
        const res = await this.send(value);
        if (res.ok) {
          this.saved = body;
          this.failures = 0;
          this.onStatus("saved");
        } else if (res.stale) {
          this.paused = true;
          this.onStatus("stale");
        } else {
          this.fail();
        }
      } catch {
        this.fail();
      }
    })();
    this.inflight = run;
    await run;
    this.inflight = null;
  }

  async pause(): Promise<void> {
    this.paused = true;
    this.clear();
    while (this.inflight) await this.inflight;
  }

  resume(): void {
    this.paused = false;
  }

  reset(baseline: T): void {
    this.clear();
    this.latest = baseline;
    this.saved = JSON.stringify(baseline);
    this.failures = 0;
    this.onStatus("idle");
  }

  dispose(): void {
    this.clear();
  }

  private fail(): void {
    this.failures += 1;
    this.onStatus("error");
    if (!this.paused) {
      this.timer = setTimeout(() => void this.flush(), Math.min(RETRY_BASE_MS * 2 ** (this.failures - 1), RETRY_MAX_MS));
    }
  }

  private clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
