import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { quizDraftSchema, type QuizDraft } from "@/lib/academy/quiz";
import type { ResourceKind } from "@/lib/academy/resources";

/**
 * Claude drafts a resource's 5-question quiz; an editor checks it before (or, for the spreadsheet import, after) it
 * goes live. Server only: needs ANTHROPIC_API_KEY. The answer comes back as structured output and is checked again
 * with the app's own quiz schema (exactly 5 questions, 4 distinct options).
 */

const MODEL = "claude-opus-5-5";

// What we ask Claude for. Lengths are checked afterwards by quizDraftSchema (the output format takes the shape only).
const outputSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()),
      answer: z.number().int(),
    }),
  ),
});

const SYSTEM = `You write short comprehension checks for UXDA, a financial UX design agency. Team members read our blog posts, listen to our podcast episodes and read design books; the check confirms they actually took in the main ideas.

Write exactly 5 multiple-choice questions, each with exactly 4 options and one right answer ("answer" is the index of the right option, 0-3).
- Ask about the central ideas, arguments and frameworks, not trivia (no dates, statistics, names of minor examples or exact wording).
- Someone who read or listened attentively should get all 5; someone who only read the title should not.
- Wrong options must be plausible but clearly wrong to an attentive reader. Never use "all of the above" or "none of the above".
- Options are similar in length and style, so the right one doesn't stand out.
- Keep each question under 200 characters and each option under 120.
- Plain English, no markdown.`;

export type QuizSource = {
  kind: ResourceKind;
  title: string;
  author?: string | null;
  description?: string | null;
  /** The article's text (a blog post, or the blog post a podcast episode is about). */
  text?: string | null;
};

function sourcePrompt(s: QuizSource): string {
  const what = s.kind === "book" ? "book" : s.kind === "podcast" ? "podcast episode" : "blog post";
  const lines = [`Write the check for this ${what}.`, "", `Title: ${s.title}`];
  if (s.author) lines.push(`Author: ${s.author}`);
  if (s.description) lines.push(`Summary: ${s.description}`);
  if (s.kind === "podcast" && s.text) lines.push("", "The episode discusses the blog post below. Base the questions on its ideas.");
  if (s.kind === "book" && !s.text) {
    lines.push("", "You have no text of the book: base the questions on its well-known central ideas. If you don't know the book well enough to do that reliably, base them on the summary only.");
  }
  if (s.text) lines.push("", "<text>", s.text, "</text>");
  return lines.join("\n");
}

export class QuizDraftError extends Error {}

function anthropic() {
  // A key that isn't scoped to a workspace has to name one on every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
}

/** Ask Claude for a quiz. Throws QuizDraftError with a message an editor can act on. */
export async function draftQuiz(source: QuizSource): Promise<QuizDraft> {
  if (!process.env.ANTHROPIC_API_KEY) throw new QuizDraftError("AI drafting isn't set up (ANTHROPIC_API_KEY is missing). Write the questions by hand.");
  if (source.kind !== "book" && !source.text?.trim() && !source.description?.trim()) {
    throw new QuizDraftError("There's no text to draft from. Write the questions by hand.");
  }
  const client = anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // On a safety decline, the API retries on a fallback model it picks for that kind of decline.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(outputSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: sourcePrompt(source) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new QuizDraftError("Claude is busy right now. Try again in a minute.");
    if (error instanceof Anthropic.AuthenticationError) throw new QuizDraftError("The Anthropic API key isn't valid.");
    if (error instanceof Anthropic.APIError) {
      console.error(`draftQuiz: ${error.status} ${error.message}`); // the API's reason, for the server log
      throw new QuizDraftError(`Claude couldn't draft the quiz (${error.status ?? "error"}). Try again or write it by hand.`);
    }
    throw new QuizDraftError("Couldn't reach Claude. Try again or write the questions by hand.");
  }
  if (response.stop_reason === "refusal") throw new QuizDraftError("Claude declined to draft this one. Write the questions by hand.");
  if (response.stop_reason === "max_tokens") throw new QuizDraftError("Claude's draft was cut off. Try again.");
  const parsed = quizDraftSchema.safeParse(response.parsed_output?.questions);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue ? `${issue.path.join(".") || "quiz"}: ${issue.message}` : "no questions";
    throw new QuizDraftError(`Claude's draft didn't fit the quiz rules (${where}). Try again.`);
  }
  return parsed.data;
}

const bookSchema = z.object({
  known: z.boolean(),
  description: z.string(),
  isbns: z.array(z.string()),
});

const BOOK_SYSTEM = `You help fill in a reading list for UXDA, a financial UX design agency. Given a book's title (and maybe author), say whether you know this specific book well.
- known: true only if you are confident which book this is and what it is about. Internal documents, playbooks, slide decks or anything you can't place: false.
- description: when known, 2-3 plain sentences on what the book is about and why a designer or strategist would read it (under 400 characters, no markdown, no praise words like "must-read"). Otherwise an empty string.
- isbns: when known, up to 3 ISBN-13s of its English editions you are confident of. Otherwise an empty list.`;

export type BookDetails = { description: string | null; isbns: string[] };

/**
 * What Claude knows about a book, for filling in a missing blurb and finding a cover (the ISBNs are checked against
 * Open Library before a cover is used). Null when Claude doesn't know the book or the call fails.
 */
export async function describeBook({ title, author }: { title: string; author?: string | null }): Promise<BookDetails | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: betaZodOutputFormat(bookSchema) },
      system: BOOK_SYSTEM,
      messages: [{ role: "user", content: `Title: ${title}${author ? `\nAuthor: ${author}` : ""}` }],
    });
    const out = bookSchema.safeParse(response.parsed_output);
    if (!out.success || !out.data.known) return null;
    const description = out.data.description.trim();
    return { description: description && description.length <= 600 ? description : null, isbns: out.data.isbns.slice(0, 3) };
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`describeBook: ${error.status} ${error.message}`);
    return null;
  }
}
