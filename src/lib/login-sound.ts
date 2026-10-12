/**
 * The login page's intro sound (public/brand/login-intro.mp3, 4 s, already trimmed with a fade-out).
 *
 * It belongs to the X sequence: when the sequence starts the sound starts, when the sequence is skipped the sound
 * fades out. Off by default; the visitor's choice is kept in localStorage. Autoplay may be blocked by the browser,
 * in which case nothing plays and nothing is reported.
 */
export const LOGIN_SOUND_SRC = "/brand/login-intro.mp3";
/** localStorage key; the value is "on" or "off". Anything else (or nothing) means off. */
export const LOGIN_SOUND_KEY = "uxda:login-sound";
/** The clip's length; keep in step with the file (ffprobe says 4.01 s). The browser's own `audio.duration` wins once it is known. */
export const LOGIN_SOUND_DURATION_S = 4;
/** Skipping the sequence fades the sound out over this long. */
export const LOGIN_SOUND_FADE_MS = 300;
/** Turned on this close to the end of the clip there's nothing worth starting. */
const END_MARGIN_S = 0.25;

export function parseSoundPreference(raw: string | null | undefined): boolean {
  return raw === "on";
}

export function soundPreferenceValue(on: boolean): "on" | "off" {
  return on ? "on" : "off";
}

/**
 * Where to start the clip when the sound is turned on `elapsedMs` into the sequence, so it lines up with what is on
 * screen. Null when the clip would be over (or nearly). `durationSeconds` is the loaded file's real length when the
 * browser knows it, so a replaced clip needs no code change.
 */
export function soundStartOffset(elapsedMs: number, durationSeconds: number = LOGIN_SOUND_DURATION_S): number | null {
  const length = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : LOGIN_SOUND_DURATION_S;
  const seconds = Math.max(0, elapsedMs) / 1000;
  return seconds < length - END_MARGIN_S ? seconds : null;
}

/** Volume `elapsedMs` into a fade-out that started at `from` (linear down to 0 over LOGIN_SOUND_FADE_MS). */
export function fadeVolume(from: number, elapsedMs: number): number {
  const k = Math.min(1, Math.max(0, elapsedMs / LOGIN_SOUND_FADE_MS));
  return Math.max(0, Math.min(1, from * (1 - k)));
}
