import { test } from "@playwright/test";
import { resolveTestProject } from "../tests/support/test-project";

export const { project: testProject, reason: skipReason } = resolveTestProject();

/** Call at the top of every spec: skips the whole file when no test project is configured. */
export function requireTestProject() {
  test.skip(!testProject, skipReason);
}
