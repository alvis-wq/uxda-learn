import { z } from "zod";
import type { Database } from "@/lib/database.types";
import {
  needsReview,
  publicQuestionSchema,
  rubricCriterionSchema,
  submissionSpecSchema,
  type PublicQuestion,
  type RubricCriterion,
  type SubmissionSpec,
} from "@/lib/content/schema";

import { isVisibleToTrack, type Audience, type Track } from "@/lib/tracks";

export type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];
export type { Audience, Track };

export type Challenge = Omit<ChallengeRow, "questions" | "submission_spec" | "rubric"> & {
  questions: PublicQuestion[];
  submission_spec: SubmissionSpec;
  rubric: RubricCriterion[];
};

/** Parse the jsonb columns of a challenge row into typed values (written by content:sync). */
export function parseChallenge(row: ChallengeRow): Challenge {
  return {
    ...row,
    questions: z.array(publicQuestionSchema).parse(row.questions ?? []),
    submission_spec: submissionSpecSchema.parse(row.submission_spec ?? {}),
    rubric: z.array(rubricCriterionSchema).parse(row.rubric ?? []),
  };
}

export function challengeNeedsReview(c: Pick<Challenge, "questions" | "submission_spec">): boolean {
  return needsReview({ questions: c.questions as never, submission: c.submission_spec });
}

/**
 * Learners see a challenge when it's published, its category isn't archived, and both the
 * category's and the challenge's audiences include `all` or their track. A tester also sees (and can take) drafts
 * that pass the same audience checks; archived stays hidden from everyone. The database enforces the same rule for
 * testers in the challenges_select policy: this is the app-side twin, used where rows are read with the service role.
 */
export function isChallengeVisible(
  challenge: { status: string; audiences: readonly Audience[] },
  category: { archived: boolean; audiences: readonly Audience[] } | null | undefined,
  track: Track | null | undefined,
  tester = false,
): boolean {
  return (
    (challenge.status === "published" || (tester && challenge.status === "draft")) &&
    !!category &&
    !category.archived &&
    isVisibleToTrack(category.audiences, track) &&
    isVisibleToTrack(challenge.audiences, track)
  );
}

export const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

export const TYPE_LABEL: Record<Challenge["type"], string> = {
  quiz: "Quiz",
  screenshot: "Screenshots",
  figma: "Figma",
  mixed: "Mixed",
  acknowledge: "Read & confirm",
};
