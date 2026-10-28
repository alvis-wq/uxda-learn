/**
 * Shared by the Academy scripts (import-academy, fill-academy-details, import-podcasts): command-line arguments, a
 * small concurrency pool, reading the spreadsheet into plain grids, and fetching a picture for the `academy` bucket.
 */
import ExcelJS from "exceljs";
import sharp from "sharp";
import { IMAGE_TYPES, downloadImage } from "../../src/lib/academy/metadata";
import type { Grid } from "./academy-import";

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Run `fn` over `items`, at most `n` at a time. */
export async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

function cellValue(v: ExcelJS.CellValue): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink cell
    if ("hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue); // formula
  }
  return String(v);
}

function toGrid(ws: ExcelJS.Worksheet): Grid {
  const grid: Grid = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: Grid[number] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellValue(row.getCell(c).value));
    grid[n - 1] = cells;
  });
  return Array.from(grid, (r) => r ?? []);
}

/** Open an .xlsx file; the returned function gives one sheet as a grid of plain cells. */
export async function readWorkbook(file: string): Promise<(sheet: string) => Grid> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return (name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`The file has no sheet called "${name}".`);
    return toGrid(ws);
  };
}

// Blog hero images and podcast covers can be several MB; the Academy shows them about 164px tall. Bigger than 1 MB →
// shrunk to a 1600px JPEG.
const MAX_DOWNLOAD = 16 * 1024 * 1024;
const SHRINK_ABOVE = 1024 * 1024;

/** A picture ready for the bucket, or null. */
export async function picture(url: string): Promise<{ type: keyof typeof IMAGE_TYPES; body: Uint8Array } | null> {
  // One retry: Open Library's covers come from archive.org, which now and then drops a connection.
  const get = () => downloadImage(url, MAX_DOWNLOAD).catch(() => null);
  const pic = (await get()) ?? (await new Promise((r) => setTimeout(r, 2000)).then(get));
  if (!pic || pic.body.byteLength <= SHRINK_ABOVE) return pic;
  const body = await sharp(pic.body).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer().catch(() => null);
  return body ? { type: "image/jpeg", body: new Uint8Array(body) } : null;
}

/** The bucket path for a new picture. */
export const picturePath = (type: keyof typeof IMAGE_TYPES) => `img/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
