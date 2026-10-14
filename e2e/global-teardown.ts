import { adminDb } from "./helpers";
import { cleanTestUserData, removeFixtures, removeOrderFixture, removeTesterFixture } from "./fixtures";
import { testProject } from "./project";

export default async function globalTeardown() {
  if (!testProject) return;
  await cleanTestUserData();
  await removeOrderFixture(); // in case the order spec stopped before its own clean-up
  await removeTesterFixture();
  await adminDb().from("profiles").update({ is_tester: false }).eq("is_tester", true); // testers are test-only state
  await removeFixtures();
}
