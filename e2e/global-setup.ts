import { cleanTestUserData, installFixtures } from "./fixtures";

export default async function globalSetup() {
  await cleanTestUserData();
  await installFixtures();
}
