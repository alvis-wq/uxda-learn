import { isChallengeVisible, type Audience, type Track } from "@/lib/challenges/model";
import { attemptState, type AttemptSummary } from "@/lib/submissions/rules";

export type InProgressChallenge = {
  slug: string;
  title: string;
  categoryTitle: string;
  /** When the draft was last saved (ISO). */
  savedAt: string;
  /** The score that counts so far, from earlier published attempts: "7 / 10". Null when none is published yet. */
  best: { score: number; max: number } | null;
};

/**
 * The challenges a learner has saved work on and can still act on: the "In progress" rule of the cards (a draft
 * and an open attempt, see `attemptState().canSubmit`), plus the challenge must still be visible to them (published,
 * their track), since each row links to it. Most recently saved first.
 */
export function inProgressChallenges(input: {
  drafts: { challenge_slug: string; updated_at: string }[];
  attempts: (AttemptSummary & { challenge_slug: string })[];
  challenges: { slug: string; title: string; status: string; category_slug: string; audiences: readonly Audience[] }[];
  categories: { slug: string; title: string; archived: boolean; audiences: readonly Audience[] }[];
  track: Track | null | undefined;
}): InProgressChallenge[] {
  const rows: InProgressChallenge[] = [];
  for (const draft of input.drafts) {
    const challenge = input.challenges.find((c) => c.slug === draft.challenge_slug);
    const category = input.categories.find((c) => c.slug === challenge?.category_slug);
    if (!challenge || !isChallengeVisible(challenge, category, input.track)) continue;

    const attempts = input.attempts.filter((a) => a.challenge_slug === challenge.slug);
    const state = attemptState(attempts);
    if (!state.canSubmit) continue;

    // The attempt that counts is the best published one (the earliest on a tie), as everywhere else.
    const counted = attempts
      .filter((a) => a.status === "published" && a.final_score !== null)
      .sort((a, b) => Number(b.final_score) - Number(a.final_score) || a.attempt - b.attempt)[0];
    rows.push({
      slug: challenge.slug,
      title: challenge.title,
      categoryTitle: category?.title ?? challenge.category_slug,
      savedAt: draft.updated_at,
      best: counted ? { score: Number(counted.final_score), max: Number(counted.max_score) } : null,
    });
  }
  return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
