import { cleanTestUserData, removeFixtures } from "./fixtures";

export default async function globalTeardown() {
  await cleanTestUserData();
  await removeFixtures();
}
