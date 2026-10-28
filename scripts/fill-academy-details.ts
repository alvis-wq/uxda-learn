/**
 * Fill in Academy resources that have no picture or no description.
 *
 *   npm run academy:fill -- --as <admin email>            # dry run: what it would fill
 *   npm run academy:fill -- --as <admin email> --apply    # writes it
 *
 * Posts and episodes: read again from their page (picture and description). Books: Open Library (searched more widely
 * than the import did), then Claude — a 2-3 sentence description for a book it knows, and ISBNs whose Open Library
 * edition has a matching title and a cover. Never overwrites a picture or description that's already there; what
 * can't be found is listed for an editor (Admin → Academy). Pictures over 1 MB are shrunk first.
 */
import sharp from "sharp";
import "./lib/env";
import { adminClient } from "./lib/supabase";
import { IMAGE_TYPES, coverForIsbn, downloadImage, lookupBook, readPage } from "../src/lib/academy/metadata";
import { describeBook } from "../src/lib/academy/quiz-ai";
import { titlesMatch } from "../src/lib/academy/resources";

const CONCURRENCY = 4;
// Blog hero images can be 5 MB; the Academy shows them about 164px tall. Bigger than 1 MB → shrunk to a 1600px JPEG.
const MAX_DOWNLOAD = 16 * 1024 * 1024;
const SHRINK_ABOVE = 1024 * 1024;

async function picture(url: string): Promise<{ type: keyof typeof IMAGE_TYPES; body: Uint8Array } | null> {
  // One retry: Open Library's covers come from archive.org, which now and then drops a connection.
  const get = () => downloadImage(url, MAX_DOWNLOAD).catch(() => null);
  const pic = (await get()) ?? (await new Promise((r) => setTimeout(r, 2000)).then(get));
  if (!pic || pic.body.byteLength <= SHRINK_ABOVE) return pic;
  const body = await sharp(pic.body).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer().catch(() => null);
  return body ? { type: "image/jpeg", body: new Uint8Array(body) } : null;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Run `fn` over `items`, at most `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const actorEmail = arg("--as")?.toLowerCase();
  if (!actorEmail) {
    console.error("Usage: npm run academy:fill -- --as <admin email> [--apply]");
    process.exit(1);
  }
  const db = adminClient();
  const { data: actor } = await db.from("profiles").select("id,is_admin").eq("email", actorEmail).maybeSingle();
  if (!actor?.is_admin) {
    console.error(`--as ${actorEmail}: no admin with that email has signed in.`);
    process.exit(1);
  }
  const { data: rows, error } = await db
    .from("academy_resources")
    .select("id,kind,title,author,url,image_path,description")
    .neq("status", "archived")
    .or("image_path.is.null,description.is.null")
    .order("kind")
    .order("title");
  if (error) throw new Error(`read academy_resources: ${error.message}`);
  console.log(`${rows.length} resources miss a picture or a description.${apply ? "" : " Dry run: nothing is written."}\n`);

  const left: string[] = [];
  await pool(rows, CONCURRENCY, async (r) => {
    let imageUrl: string | null = null;
    let description: string | null = null;
    const from: string[] = [];
    try {
      if (r.kind !== "book") {
        if (r.url) {
          const page = await readPage(r.url).catch(() => null);
          imageUrl = page?.imageUrl ?? null;
          description = page?.description ?? null;
          if (page) from.push("page");
        }
      } else {
        const book = await lookupBook({ title: r.title, author: r.author, url: r.url }).catch(() => null);
        if (book && titlesMatch(r.title, book.title)) {
          imageUrl = book.coverUrl;
          description = book.description;
          if (imageUrl || description) from.push("Open Library");
        }
        if ((!r.image_path && !imageUrl) || (!r.description && !description)) {
          const known = await describeBook({ title: r.title, author: r.author });
          if (known) {
            if (!r.description && !description && known.description) {
              description = known.description;
              from.push("Claude (description)");
            }
            for (const isbn of r.image_path || imageUrl ? [] : known.isbns) {
              imageUrl = await coverForIsbn(isbn, r.title).catch(() => null);
              if (imageUrl) {
                from.push(`ISBN ${isbn}`);
                break;
              }
            }
          }
        }
      }

      const update: { image_path?: string; description?: string; updated_by: string } = { updated_by: actor.id };
      if (!r.image_path && imageUrl) {
        const pic = await picture(imageUrl);
        if (pic) {
          const path = `img/${crypto.randomUUID()}.${IMAGE_TYPES[pic.type]}`;
          if (apply) {
            const up = await db.storage.from("academy").upload(path, pic.body, { contentType: pic.type });
            if (!up.error) update.image_path = path;
          } else update.image_path = path;
        }
      }
      if (!r.description && description) update.description = description;

      const filled = [update.image_path && "picture", update.description && "description"].filter(Boolean);
      const missing = [!r.image_path && !update.image_path && "picture", !r.description && !update.description && "description"].filter(Boolean);
      if (filled.length && apply) {
        const { error: upError } = await db.from("academy_resources").update(update).eq("id", r.id);
        if (upError) throw new Error(upError.message);
      }
      console.log(`  ${filled.length ? "✓" : "–"} ${r.kind.padEnd(7)} ${r.title}${filled.length ? `: ${filled.join(" + ")} (${from.join(", ")})` : ""}`);
      if (missing.length) left.push(`${r.title}: no ${missing.join(" or ")}`);
    } catch (e) {
      console.log(`  ✗ ${r.kind.padEnd(7)} ${r.title}: ${e instanceof Error ? e.message : e}`);
      left.push(`${r.title}: failed`);
    }
  });

  if (left.length) {
    console.log(`\n${left.length} still need an editor (Admin → Academy):`);
    for (const l of left.sort()) console.log(`  ${l}`);
  }
  if (!apply) console.log("\nDry run: nothing written. Add --apply to fill them in.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
