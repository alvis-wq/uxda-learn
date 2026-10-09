import { cleanTestUserData, removeFixtures } from "./fixtures";
import { testProject } from "./project";

export default async function globalTeardown() {
  if (!testProject) return;
  await cleanTestUserData();
  await removeFixtures();
}
