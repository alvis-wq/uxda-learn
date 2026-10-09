import * as shared from "../tests/support/fixtures";
import { adminDb } from "./helpers";

export const cleanTestUserData = () => shared.cleanTestUserData(adminDb());
export const installFixtures = () => shared.installFixtures(adminDb());
export const removeFixtures = () => shared.removeFixtures(adminDb());
