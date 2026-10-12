/** Browser-only helpers for the glass X. Nothing here imports three. */

let webgl2: boolean | undefined;

/** True when a WebGL2 context can be created (three r186 needs it). Probed once, and the probe context is released. */
export function supportsWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    webgl2 = gl != null;
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

/** Runs `task` when the browser is idle (or after a short delay where requestIdleCallback is missing). Returns a cancel function. */
export function whenIdle(task: () => void, timeout = 500): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(task, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(task, 200);
  return () => clearTimeout(id);
}
