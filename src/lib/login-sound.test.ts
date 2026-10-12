import { describe, expect, it } from "vitest";
import { LOGIN_SEQ_END_MS } from "./login-sequence";
import {
  LOGIN_SOUND_DURATION_S,
  LOGIN_SOUND_FADE_MS,
  LOGIN_SOUND_KEY,
  LOGIN_SOUND_SRC,
  fadeVolume,
  parseSoundPreference,
  soundPreferenceValue,
  soundStartOffset,
} from "./login-sound";

describe("login sound preference", () => {
  it("is off unless the visitor turned it on", () => {
    expect(parseSoundPreference(null)).toBe(false);
    expect(parseSoundPreference(undefined)).toBe(false);
    expect(parseSoundPreference("")).toBe(false);
    expect(parseSoundPreference("off")).toBe(false);
    expect(parseSoundPreference("true")).toBe(false);
    expect(parseSoundPreference("on")).toBe(true);
  });

  it("round-trips through the stored value", () => {
    expect(parseSoundPreference(soundPreferenceValue(true))).toBe(true);
    expect(parseSoundPreference(soundPreferenceValue(false))).toBe(false);
  });

  it("uses the agreed file, key and fade", () => {
    expect(LOGIN_SOUND_SRC).toBe("/brand/login-intro.mp3");
    expect(LOGIN_SOUND_KEY).toBe("uxda:login-sound");
    expect(LOGIN_SOUND_DURATION_S).toBe(4);
    expect(LOGIN_SOUND_FADE_MS).toBe(300);
  });
});

describe("soundStartOffset (turned on mid-sequence)", () => {
  it("starts at the position the sequence has reached", () => {
    expect(soundStartOffset(0)).toBe(0);
    expect(soundStartOffset(1800)).toBeCloseTo(1.8);
    expect(soundStartOffset(2500)).toBeCloseTo(2.5);
  });
  it("never starts before 0 (a clock that ran slightly backwards)", () => {
    expect(soundStartOffset(-40)).toBe(0);
  });
  it("starts nothing once the clip is over, or about to be (4 s clip)", () => {
    expect(soundStartOffset(4000)).toBeNull();
    expect(soundStartOffset(3800)).toBeNull();
    expect(soundStartOffset(3700)).toBeCloseTo(3.7);
  });
  it("uses the loaded file's real length when the browser knows it", () => {
    expect(soundStartOffset(5000, 6)).toBeCloseTo(5);
    expect(soundStartOffset(3000, 3)).toBeNull();
    expect(soundStartOffset(3000, Number.NaN)).toBeCloseTo(3); // metadata not loaded yet: the constant applies
    expect(soundStartOffset(3000, Number.POSITIVE_INFINITY)).toBeCloseTo(3);
  });
  it("the whole sequence fits inside the clip, so turning the sound on at any moment of it starts something", () => {
    expect(LOGIN_SEQ_END_MS / 1000).toBeLessThan(LOGIN_SOUND_DURATION_S - 0.25);
    expect(soundStartOffset(LOGIN_SEQ_END_MS - 1)).not.toBeNull();
  });
});

describe("fadeVolume", () => {
  it("ramps linearly from the current volume to silence over ~0.3 s", () => {
    expect(fadeVolume(1, 0)).toBe(1);
    expect(fadeVolume(1, 150)).toBeCloseTo(0.5);
    expect(fadeVolume(1, LOGIN_SOUND_FADE_MS)).toBe(0);
    expect(fadeVolume(1, 1000)).toBe(0);
  });
  it("starts from wherever the volume is, and is clamped", () => {
    expect(fadeVolume(0.6, 150)).toBeCloseTo(0.3);
    expect(fadeVolume(1, -50)).toBe(1);
    expect(fadeVolume(2, 0)).toBe(1);
  });
});
