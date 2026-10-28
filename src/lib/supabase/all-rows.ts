/**
 * The API returns at most 1,000 rows a request (`max_rows` in supabase/config.toml, the hosted default too): a read
 * that can grow past that goes page by page. `page(from, to)` is the query with a stable order and `.range(from, to)`.
 */
export const PAGE_SIZE = 1000;

export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
