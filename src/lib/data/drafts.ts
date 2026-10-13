import "server-only";
import type { PublicQuestion, SubmissionSpec } from "@/lib/content/schema";
import { createClient } from "@/lib/supabase/server";
import { isBlankDraft, restoreDraft, type Draft, type DraftRow } from "@/lib/submissions/draft";

const SIGNED_URL_SECONDS = 6 * 60 * 60;

/** What the stepped form starts from when the learner has saved work. */
export type FormDraft = {
  draft: Draft;
  /** The screenshots of the draft, with a signed URL for the preview (the browser can't read the private bucket). */
  images: { path: string; previewUrl: string; name: string }[];
  /** Some answers no longer fit the challenge (it changed since they were saved) and were left out. */
  reset: boolean;
  savedAt: string;
};

/**
 * The learner's saved draft, made to fit the challenge as it is now (see restoreDraft) and with its screenshots
 * checked: each is looked up in Storage, so a screenshot that has gone since is dropped rather than shown broken.
 * Null when there is nothing worth continuing.
 */
export async function prepareFormDraft(
  row: DraftRow,
  challenge: { slug: string; version: number; questions: PublicQuestion[]; submission_spec: SubmissionSpec },
  userId: string,
  stepCount: number,
): Promise<FormDraft | null> {
  const { draft, reset } = restoreDraft(row, challenge, userId, stepCount);

  const images: FormDraft["images"] = [];
  if (draft.imagePaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("submissions").createSignedUrls(draft.imagePaths, SIGNED_URL_SECONDS);
    const urls = new Map((data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => [d.path, d.signedUrl]));
    for (const path of draft.imagePaths) {
      const previewUrl = urls.get(path);
      if (previewUrl) images.push({ path, previewUrl, name: `Screenshot ${images.length + 1}` });
    }
  }

  const kept = { ...draft, imagePaths: images.map((i) => i.path) };
  if (isBlankDraft(kept) && !reset) return null;
  return { draft: kept, images, reset, savedAt: row.updated_at };
}
