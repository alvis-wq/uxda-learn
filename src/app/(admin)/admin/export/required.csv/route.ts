import { NextResponse, type NextRequest } from "next/server";
import { buildRequiredProgress, REQUIRED_CSV_HEADER, requiredProgressCsvRows } from "@/lib/admin/required-progress";
import { getAdminOrNull } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { loadProgressInput } from "@/lib/data/admin-progress";
import { isTrack } from "@/lib/tracks";

/** CSV of required progress: one row per (user, required challenge or path), with an item_type column. Admins only. */
export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const requested = request.nextUrl.searchParams.get("track");
  const track = isTrack(requested) ? requested : undefined;

  let input;
  try {
    input = await loadProgressInput();
  } catch {
    return new NextResponse("Couldn't load progress", { status: 500 });
  }
  const rows = requiredProgressCsvRows(buildRequiredProgress(input, track));

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv([REQUIRED_CSV_HEADER, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uxda-learn-required-${track ?? "all"}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
