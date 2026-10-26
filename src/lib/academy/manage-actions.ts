"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FetchError, IMAGE_TYPES, MAX_IMAGE_BYTES, downloadImage, lookupBook, readPage, sniffImageType, type ImageType } from "@/lib/academy/metadata";
import { quizDraftSchema, splitQuiz, type QuizDraft } from "@/lib/academy/quiz";
import { QuizDraftError, draftQuiz } from "@/lib/academy/quiz-ai";
import { BOOK_CATEGORIES, resourceKindSchema, type ResourceKind } from "@/lib/academy/resources";
import { getAcademyEditorOrNull } from "@/lib/auth/academy-editor";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Academy management, for Academy editors and admins (Admin → Academy, and /academy/manage for editors who aren't
 * admins). Every action checks the role first, then writes with the service role: there are no client write policies
 * on the Academy tables or the `academy` bucket.
 */

export type ManageResult<T = undefined> = ({ ok: true } & (T extends undefined ? unknown : { data: T })) | { ok: false; error: string };

const NOT_EDITOR = { ok: false, error: "Only Academy editors and admins can do this." } as const;
const idSchema = z.uuid();
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "must be a link starting with https://");

function revalidateAcademy() {
  revalidatePath("/academy", "layout");
  revalidatePath("/admin/academy", "layout");
}

// Link preview -------------------------------------------------------------------------------------------------

export type Preview = { title: string | null; description: string | null; author: string | null; imageUrl: string | null };

/**
 * Read a link's details for the add form: title, short description and picture from the page (blog posts and
 * podcast episodes), or from Open Library (books: by the ISBN in an Amazon link, else by title). Nothing is saved.
 */
export async function previewLink(kindInput: string, urlInput: string, titleInput?: string): Promise<ManageResult<Preview>> {
  if (!(await getAcademyEditorOrNull())) return NOT_EDITOR;
  const kind = resourceKindSchema.safeParse(kindInput);
  const url = urlInput ? httpUrl.safeParse(urlInput) : null;
  if (!kind.success || (url && !url.success)) return { ok: false, error: "Enter a link starting with https://." };
  const title = titleInput?.trim() || null;
  try {
    if (kind.data === "book") {
      const book = await lookupBook({ url: url?.data, title });
      if (book) return { ok: true, data: { title: book.title, description: book.description, author: book.author, imageUrl: book.coverUrl } };
      if (!url) return { ok: false, error: "No book found with that title. Fill in the details by hand." };
      const page = await readPage(url.data).catch(() => null);
      if (page) return { ok: true, data: { title: page.title, description: page.description, author: null, imageUrl: page.imageUrl } };
      return { ok: false, error: "Couldn't find details for this book. Fill them in by hand." };
    }
    if (!url) return { ok: false, error: "Enter the link first." };
    const page = await readPage(url.data);
    return { ok: true, data: { title: page.title, description: page.description, author: null, imageUrl: page.imageUrl } };
  } catch (error) {
    if (error instanceof FetchError) return { ok: false, error: `Couldn't read that link: ${error.message} Fill in the details by hand.` };
    return { ok: false, error: "Couldn't read that link. Fill in the details by hand." };
  }
}

// Pictures -----------------------------------------------------------------------------------------------------

/** Paths this module writes in the `academy` bucket. */
const IMAGE_PATH_PATTERN = /^img\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

async function storeImage(type: ImageType, body: Uint8Array): Promise<string> {
  const path = `img/${randomUUID()}.${IMAGE_TYPES[type]}`;
  const { error } = await createAdminClient().storage.from("academy").upload(path, body, { contentType: type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Upload a picture chosen by the editor (FormData field `file`). Returns its path in the bucket. */
export async function uploadAcademyImage(form: FormData): Promise<ManageResult<{ path: string }>> {
  if (!(await getAcademyEditorOrNull())) return NOT_EDITOR;
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a picture." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "The picture is bigger than 4 MB." };
  const body = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(body);
  if (!type) return { ok: false, error: "Use a PNG, JPEG or WebP picture." };
  try {
    return { ok: true, data: { path: await storeImage(type, body) } };
  } catch {
    return { ok: false, error: "Couldn't upload the picture." };
  }
}

// Resources ----------------------------------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `keep it under ${max} characters`)
    .transform((v) => v || null)
    .nullable()
    .optional();

const imageInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("keep") }),
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("path"), path: z.string().regex(IMAGE_PATH_PATTERN) }),
  z.object({ type: z.literal("remote"), url: httpUrl }),
]);

const resourceInputSchema = z
  .object({
    kind: resourceKindSchema,
    title: z.string().trim().min(1, "Enter a title.").max(300, "keep it under 300 characters"),
    url: httpUrl.nullable().optional().or(z.literal("").transform(() => null)),
    description: optionalText(1200),
    author: optionalText(200),
    category: z.enum(BOOK_CATEGORIES).nullable().optional(),
    blogId: idSchema.nullable().optional(),
    image: imageInputSchema,
  })
  .refine((r) => r.kind === "book" || !!r.url, { message: "Blog posts and podcast episodes need a link.", path: ["url"] });

export type ResourceInput = z.input<typeof resourceInputSchema>;

function fieldErrors(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(" ");
}

async function resolveImage(image: z.infer<typeof imageInputSchema>): Promise<{ path: string | null } | "keep"> {
  if (image.type === "keep") return "keep";
  if (image.type === "none") return { path: null };
  if (image.type === "path") return { path: image.path };
  const pic = await downloadImage(image.url);
  return { path: await storeImage(pic.type, pic.body) };
}

/** A podcast may only point at an existing blog post that has no other episode. */
async function checkBlogLink(blogId: string | null | undefined, selfId: string | null): Promise<string | null> {
  if (!blogId) return null;
  const admin = createAdminClient();
  const { data: blog } = await admin.from("academy_resources").select("id,kind").eq("id", blogId).maybeSingle();
  if (!blog || blog.kind !== "blog") return "Choose a blog post for this episode.";
  const { data: taken } = await admin.from("academy_resources").select("id").eq("blog_id", blogId).maybeSingle();
  if (taken && taken.id !== selfId) return "That blog post already has a podcast episode.";
  return null;
}

/** Create a resource as a draft. Returns its id (the form then opens it to add the quiz). */
export async function createResource(raw: ResourceInput): Promise<ManageResult<{ id: string }>> {
  const editor = await getAcademyEditorOrNull();
  if (!editor) return NOT_EDITOR;
  const parsed = resourceInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  const r = parsed.data;
  const blogError = r.kind === "podcast" ? await checkBlogLink(r.blogId, null) : null;
  if (blogError) return { ok: false, error: blogError };

  let image: { path: string | null } | "keep";
  try {
    image = await resolveImage(r.image);
  } catch {
    return { ok: false, error: "Couldn't save the picture. Upload one instead, or leave it out." };
  }
  const { data, error } = await createAdminClient()
    .from("academy_resources")
    .insert({
      kind: r.kind,
      title: r.title,
      url: r.url ?? null,
      description: r.description ?? null,
      author: r.kind === "book" ? (r.author ?? null) : null,
      category: r.kind === "book" ? (r.category ?? "academy") : null,
      blog_id: r.kind === "podcast" ? (r.blogId ?? null) : null,
      image_path: image === "keep" ? null : image.path,
      created_by: editor.id,
      updated_by: editor.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Something with this link is already in the Academy." };
  if (error || !data) return { ok: false, error: "Couldn't save it." };
  revalidateAcademy();
  return { ok: true, data: { id: data.id } };
}

/** Update a resource's details (not its quiz or status). */
export async function updateResource(id: string, raw: ResourceInput): Promise<ManageResult> {
  const editor = await getAcademyEditorOrNull();
  if (!editor) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  const parsed = resourceInputSchema.safeParse(raw);
  if (!rid.success) return { ok: false, error: "Not found." };
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  const r = parsed.data;

  const admin = createAdminClient();
  const { data: current } = await admin.from("academy_resources").select("kind").eq("id", rid.data).maybeSingle();
  if (!current) return { ok: false, error: "Not found." };
  if (current.kind !== r.kind) return { ok: false, error: "The kind of a resource can't change." };
  const blogError = r.kind === "podcast" ? await checkBlogLink(r.blogId, rid.data) : null;
  if (blogError) return { ok: false, error: blogError };

  let image: { path: string | null } | "keep";
  try {
    image = await resolveImage(r.image);
  } catch {
    return { ok: false, error: "Couldn't save the picture. Upload one instead, or leave it out." };
  }
  const { error } = await admin
    .from("academy_resources")
    .update({
      title: r.title,
      url: r.url ?? null,
      description: r.description ?? null,
      author: r.kind === "book" ? (r.author ?? null) : null,
      category: r.kind === "book" ? (r.category ?? "academy") : null,
      blog_id: r.kind === "podcast" ? (r.blogId ?? null) : null,
      ...(image === "keep" ? {} : { image_path: image.path }),
      updated_by: editor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rid.data);
  if (error?.code === "23505") return { ok: false, error: "Something with this link is already in the Academy." };
  if (error) return { ok: false, error: "Couldn't save the changes." };
  revalidateAcademy();
  return { ok: true };
}

// Quiz ---------------------------------------------------------------------------------------------------------

/** Text for Claude: the post itself; for a podcast, the blog post it's about (else its own page). */
async function quizSourceText(kind: ResourceKind, url: string | null, blogUrl: string | null): Promise<string | null> {
  const from = kind === "podcast" ? (blogUrl ?? url) : kind === "blog" ? url : null;
  if (!from) return null;
  const page = await readPage(from);
  return page.text || null;
}

/** Ask Claude to draft the 5 questions. Nothing is saved: the editor checks them and saves. */
export async function draftQuizWithAI(id: string): Promise<ManageResult<{ quiz: QuizDraft }>> {
  if (!(await getAcademyEditorOrNull())) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  if (!rid.success) return { ok: false, error: "Not found." };
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("academy_resources")
    .select("kind,title,url,description,author,blog_id")
    .eq("id", rid.data)
    .maybeSingle();
  if (!r) return { ok: false, error: "Not found." };
  let blogUrl: string | null = null;
  if (r.blog_id) {
    const { data: blog } = await admin.from("academy_resources").select("url").eq("id", r.blog_id).maybeSingle();
    blogUrl = blog?.url ?? null;
  }
  try {
    const text = await quizSourceText(r.kind as ResourceKind, r.url, blogUrl).catch(() => null);
    const quiz = await draftQuiz({ kind: r.kind as ResourceKind, title: r.title, author: r.author, description: r.description, text });
    return { ok: true, data: { quiz } };
  } catch (error) {
    if (error instanceof QuizDraftError) return { ok: false, error: error.message };
    return { ok: false, error: "Couldn't draft the quiz. Try again or write it by hand." };
  }
}

/** Save the quiz an editor has checked: public questions on the resource, the answers in academy_quiz_keys. */
export async function saveQuiz(id: string, raw: QuizDraft): Promise<ManageResult> {
  const editor = await getAcademyEditorOrNull();
  if (!editor) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  const quiz = quizDraftSchema.safeParse(raw);
  if (!rid.success) return { ok: false, error: "Not found." };
  if (!quiz.success) return { ok: false, error: `The quiz isn't complete: ${fieldErrors(quiz.error)}` };
  const { questions, answerKey } = splitQuiz(quiz.data);
  const admin = createAdminClient();
  // Key first: a published quiz is never left with questions that don't match its key for longer than this request.
  const key = await admin.from("academy_quiz_keys").upsert({ resource_id: rid.data, answer_key: answerKey });
  if (key.error) return { ok: false, error: "Couldn't save the quiz." };
  const { error } = await admin
    .from("academy_resources")
    .update({ questions, quiz_reviewed: true, updated_by: editor.id, updated_at: new Date().toISOString() })
    .eq("id", rid.data);
  if (error) return { ok: false, error: "Couldn't save the quiz." };
  revalidateAcademy();
  return { ok: true };
}

/** Mark an imported (Claude-drafted) quiz as checked without changing it. */
export async function markQuizReviewed(id: string): Promise<ManageResult> {
  const editor = await getAcademyEditorOrNull();
  if (!editor) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  if (!rid.success) return { ok: false, error: "Not found." };
  const { error } = await createAdminClient()
    .from("academy_resources")
    .update({ quiz_reviewed: true, updated_by: editor.id, updated_at: new Date().toISOString() })
    .eq("id", rid.data);
  if (error) return { ok: false, error: "Couldn't update it." };
  revalidateAcademy();
  return { ok: true };
}

// Status -------------------------------------------------------------------------------------------------------

const statusSchema = z.enum(["draft", "published", "archived"]);

/**
 * Publish (everyone sees it), back to draft, or archive. Publishing needs a full quiz (the table refuses it too).
 * Resources people have completed are never deleted, only archived.
 */
export async function setResourceStatus(id: string, statusInput: string): Promise<ManageResult> {
  const editor = await getAcademyEditorOrNull();
  if (!editor) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  const status = statusSchema.safeParse(statusInput);
  if (!rid.success || !status.success) return { ok: false, error: "Invalid input." };
  const admin = createAdminClient();
  const { data: r } = await admin.from("academy_resources").select("questions,published_at").eq("id", rid.data).maybeSingle();
  if (!r) return { ok: false, error: "Not found." };
  if (status.data === "published" && (!Array.isArray(r.questions) || r.questions.length !== 5)) {
    return { ok: false, error: "Add the 5 quiz questions before publishing." };
  }
  const { error } = await admin
    .from("academy_resources")
    .update({
      status: status.data,
      ...(status.data === "published" && !r.published_at ? { published_at: new Date().toISOString() } : {}),
      updated_by: editor.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rid.data);
  if (error) return { ok: false, error: "Couldn't change the status." };
  revalidateAcademy();
  return { ok: true };
}

/** Delete a draft nobody has completed or tried (a mistake). Anything else is archived instead. */
export async function deleteDraftResource(id: string): Promise<ManageResult> {
  if (!(await getAcademyEditorOrNull())) return NOT_EDITOR;
  const rid = idSchema.safeParse(id);
  if (!rid.success) return { ok: false, error: "Not found." };
  const admin = createAdminClient();
  const [{ data: r }, completions, attempts, episodes] = await Promise.all([
    admin.from("academy_resources").select("status").eq("id", rid.data).maybeSingle(),
    admin.from("academy_completions").select("user_id", { count: "exact", head: true }).eq("resource_id", rid.data),
    admin.from("academy_quiz_attempts").select("id", { count: "exact", head: true }).eq("resource_id", rid.data),
    admin.from("academy_resources").select("id", { count: "exact", head: true }).eq("blog_id", rid.data),
  ]);
  if (!r) return { ok: false, error: "Not found." };
  if (r.status !== "draft" || (completions.count ?? 0) > 0 || (attempts.count ?? 0) > 0) {
    return { ok: false, error: "Only an unused draft can be deleted. Archive it instead." };
  }
  if ((episodes.count ?? 0) > 0) return { ok: false, error: "A podcast episode is linked to this post. Unlink or delete it first." };
  const { error } = await admin.from("academy_resources").delete().eq("id", rid.data);
  if (error) return { ok: false, error: "Couldn't delete it." };
  revalidateAcademy();
  return { ok: true };
}
