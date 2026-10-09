import { cleanTestUserData, installFixtures } from "./fixtures";
import { skipReason, testProject } from "./project";

export default async function globalSetup() {
  if (!testProject) {
    console.log(`\n[e2e] ${skipReason}\n`);
    return;
  }
  await cleanTestUserData();
  await installFixtures();
}
