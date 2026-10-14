import { cleanTestUserData, removeFixtures, removeOrderFixture } from "./fixtures";
import { testProject } from "./project";

export default async function globalTeardown() {
  if (!testProject) return;
  await cleanTestUserData();
  await removeOrderFixture(); // in case the order spec stopped before its own clean-up
  await removeFixtures();
}
