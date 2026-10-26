import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

/**
 * Reading other sites for the Academy: a link's title, description and picture (blog posts, podcast episodes), an
 * article's text (for Claude to draft a quiz from), and book covers and blurbs from Open Library.
 *
 * Every fetch goes through `safeFetch`: http(s) only, no private / loopback / link-local addresses (checked on every
 * redirect hop), a timeout and a size cap. Editors are staff, but the server shouldn't fetch whatever it's handed.
 */

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = "UXDA-Learn/1.0 (+academy link preview)";

/** True for addresses the server must never fetch: private, loopback, link-local, CGNAT, multicast, unspecified. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

export class FetchError extends Error {}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Only http(s) links can be read.");
  if (url.username || url.password) throw new FetchError("Links with a username or password can't be read.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new FetchError("That link points somewhere the server can't read.");
}

/** Fetch a public URL (following up to 4 redirects, each checked) and return its body, at most 2 MB. */
export async function safeFetch(input: string, accept: string): Promise<{ url: string; contentType: string; body: Uint8Array }> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("That doesn't look like a link.");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new FetchError(`The site answered ${res.status}.`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new FetchError("That page is too big to read.");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new FetchError("That page is too big to read.");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.byteLength;
    }
    return { url: url.toString(), contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new FetchError("Too many redirects.");
}

// HTML parsing (small and dependency-free: we only need a few meta tags and the visible text) ------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}

/** The content of the first <meta> whose property/name is one of `keys` (in order of preference). */
function meta(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const tag of tags) {
      const k = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
      if (k === key) {
        const v = attr(tag, "content");
        if (v) return v;
      }
    }
  }
  return null;
}

export type LinkPreview = { title: string | null; description: string | null; imageUrl: string | null };

/** Title, description and picture of a page, from Open Graph / Twitter / plain meta tags. */
export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = meta(head, ["og:title", "twitter:title"]) ?? (titleTag ? decodeEntities(titleTag).replace(/\s+/g, " ").trim() : null);
  const description = meta(head, ["og:description", "twitter:description", "description"]);
  const image = meta(head, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
  let imageUrl: string | null = null;
  if (image) {
    try {
      const u = new URL(image, pageUrl);
      if (u.protocol === "https:" || u.protocol === "http:") imageUrl = u.toString();
    } catch {
      imageUrl = null;
    }
  }
  return { title: title || null, description: description || null, imageUrl };
}

/** The readable text of a page: <article> or <main> when there is one, without scripts, styles, nav and markup. */
export function extractText(html: string): string {
  const body = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  return decodeEntities(
    body
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|h[1-6]|li|br|section|blockquote|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function asHtml(contentType: string, body: Uint8Array): string {
  if (contentType && !/html|xml/i.test(contentType)) throw new FetchError("That link isn't a web page.");
  return new TextDecoder("utf-8").decode(body);
}

/** Fetch a page and read its preview (title, description, picture URL) and text. */
export async function readPage(url: string): Promise<LinkPreview & { text: string }> {
  const page = await safeFetch(url, "text/html,application/xhtml+xml");
  const html = asHtml(page.contentType, page.body);
  return { ...parseLinkPreview(html, page.url), text: extractText(html) };
}

// Pictures --------------------------------------------------------------------------------------------------

export const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** The image type from the file's first bytes (never trust a header or a file name). */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Download a picture (a thumbnail or cover) for storing in our bucket. */
export async function downloadImage(url: string): Promise<{ type: ImageType; body: Uint8Array }> {
  const res = await safeFetch(url, "image/png,image/jpeg,image/webp");
  const type = sniffImageType(res.body);
  if (!type) throw new FetchError("The picture isn't a PNG, JPEG or WebP.");
  if (res.body.byteLength > MAX_IMAGE_BYTES) throw new FetchError("The picture is bigger than 4 MB.");
  return { type, body: res.body };
}

// Books (Open Library) -------------------------------------------------------------------------------------

/** An ISBN in an Amazon link (/dp/<isbn10> or /gp/product/<isbn10>), or null. */
export function isbnFromUrl(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product)\/(\d{9}[\dX])(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

const searchDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
});
const searchSchema = z.object({ docs: z.array(searchDocSchema) });
const workSchema = z.object({ description: z.union([z.string(), z.object({ value: z.string() })]).optional() });

export type BookInfo = { title: string; author: string | null; description: string | null; coverUrl: string | null };

async function getJson(url: string): Promise<unknown> {
  const res = await safeFetch(url, "application/json");
  return JSON.parse(new TextDecoder().decode(res.body));
}

/** Clean an Open Library blurb: drop "([source][1])" link lists and trailing reference blocks. */
export function cleanBlurb(s: string): string {
  return s
    .split(/\n-{3,}|\n\s*\[\d+\]:/)[0]
    .replace(/\(\[[^\]]*\]\[\d+\]\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look a book up on Open Library: by the ISBN in its link when there is one, otherwise by title (and author). The
 * cover comes from covers.openlibrary.org and the blurb from the work record. Null when nothing matches.
 */
export async function lookupBook({ title, author, url }: { title?: string | null; author?: string | null; url?: string | null }): Promise<BookInfo | null> {
  const isbn = url ? isbnFromUrl(url) : null;
  const q = new URLSearchParams({ limit: "1", fields: "key,title,author_name,cover_i" });
  if (isbn) q.set("isbn", isbn);
  else if (title) {
    q.set("title", title);
    if (author) q.set("author", author);
  } else return null;
  const search = searchSchema.safeParse(await getJson(`https://openlibrary.org/search.json?${q}`));
  const doc = search.success ? search.data.docs[0] : undefined;
  if (!doc) return null;
  let description: string | null = null;
  if (/^\/works\/OL\d+W$/.test(doc.key)) {
    const work = workSchema.safeParse(await getJson(`https://openlibrary.org${doc.key}.json`).catch(() => null));
    const d = work.success ? work.data.description : undefined;
    description = d ? cleanBlurb(typeof d === "string" ? d : d.value) || null : null;
  }
  return {
    title: doc.title,
    author: doc.author_name?.join(", ") ?? null,
    description,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
  };
}
