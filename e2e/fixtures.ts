import path from "node:path";
import * as shared from "../tests/support/fixtures";
import { adminDb } from "./helpers";

/** The order-question challenge lives apart from the main fixtures so the other specs' challenge counts stay as they are. */
const ORDER_FIXTURE_DIR = path.join(__dirname, "fixtures", "order-content");

export const cleanTestUserData = () => shared.cleanTestUserData(adminDb());
export const installFixtures = () => shared.installFixtures(adminDb());
export const removeFixtures = () => shared.removeFixtures(adminDb());
const TESTER_FIXTURE_DIR = path.join(__dirname, "fixtures", "tester-content");
export const installTesterFixture = () => shared.installFixtures(adminDb(), TESTER_FIXTURE_DIR);
export const removeTesterFixture = () => shared.removeChallenges(adminDb(), ["e2e-draft-quiz"]);
export const installOrderFixture = () => shared.installFixtures(adminDb(), ORDER_FIXTURE_DIR);
export const removeOrderFixture = () => shared.removeChallenges(adminDb(), ["e2e-order"]);
