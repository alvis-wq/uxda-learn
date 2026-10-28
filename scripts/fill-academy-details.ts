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
import "./lib/env";
import { arg, picture, picturePath, pool } from "./lib/academy-scripts";
import { adminClient } from "./lib/supabase";
import { coverForIsbn, lookupBook, readPage } from "../src/lib/academy/metadata";
import { describeBook } from "../src/lib/academy/quiz-ai";
import { titlesMatch } from "../src/lib/academy/resources";

const CONCURRENCY = 4;

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
          const path = picturePath(pic.type);
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
