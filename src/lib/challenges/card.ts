import type { SubmissionStatus } from "@/lib/submissions/rules";

/** Label of a challenge card's call-to-action, from where the learner is with it. */
export type CardCta = "Start" | "Continue" | "View result";

export function cardCta(input: {
  type: "quiz" | "screenshot" | "figma" | "mixed" | "acknowledge";
  /** Acknowledged (acknowledge challenges) — they have no submissions. */
  acknowledged?: boolean;
  latestStatus: SubmissionStatus | null | undefined;
}): CardCta {
  if (input.type === "acknowledge") return input.acknowledged ? "View result" : "Start";
  switch (input.latestStatus) {
    case "submitted":
    case "ai_reviewed":
    case "published":
      return "View result";
    case "needs_resubmission":
      return "Continue";
    default:
      return "Start";
  }
}

/** Where card artwork lives (public/challenges/). Files are referenced by bare name from content. */
export const CARD_IMAGE_DIR = "/challenges";

/** A challenge's own image, else its category's default, else none. */
export function resolveCardImage(
  challengeImage: string | null | undefined,
  categoryImage: string | null | undefined,
): string | null {
  const name = challengeImage || categoryImage;
  return name ? `${CARD_IMAGE_DIR}/${name}` : null;
}

/**
 * Alternating wide / narrow cards, two per row on desktop (7/5, then 5/7, ...). A last card left alone in its
 * row takes the full width. On mobile every card is one column wide regardless.
 */
export type CardSpan = "wide" | "narrow" | "full";

export function cardSpans(count: number): CardSpan[] {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 2);
    const first = i % 2 === 0;
    if (first && i === count - 1) return "full";
    return (row % 2 === 0) === first ? "wide" : "narrow";
  });
}
