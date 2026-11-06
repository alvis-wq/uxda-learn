import { RESOURCE_KINDS, byNewest, type ResourceKind } from "@/lib/academy/resources";

export type TeamAcademyInput = {
  members: { id: string; full_name: string | null }[];
  resources: { id: string; kind: string; title: string; sort_key: number }[];
  completions: { user_id: string; resource_id: string; completed_at: string; is_imported: boolean }[];
  reading: { user_id: string; resource_id: string; started_at: string }[];
};

export type TeamAcademyPerson = {
  id: string;
  name: string;
  done: Record<ResourceKind, number>;
  total: number;
  last: string | null;
  /** Titles of the books they're reading now (not yet completed). */
  reading: string[];
};
export type TeamAcademyResource = { id: string; kind: ResourceKind; title: string; doneBy: string[]; readingBy: string[] };

/**
 * The Team page's Academy view: per person how many blog posts, podcasts and books they've completed (and when they
 * last completed one) and which books they're reading now, and per resource who has done it or is reading it. Only
 * published resources (the caller passes those) count; a book someone has completed isn't "reading" any more.
 */
export function buildTeamAcademy({ members, resources, completions, reading }: TeamAcademyInput) {
  const kindOf = new Map(resources.map((r) => [r.id, r.kind as ResourceKind]));
  const names = new Map(members.map((m) => [m.id, m.full_name?.trim() || "Unnamed"]));
  const totals = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, resources.filter((r) => r.kind === k).length])) as Record<ResourceKind, number>;

  const people: TeamAcademyPerson[] = members.map((m) => ({
    id: m.id,
    name: names.get(m.id)!,
    done: { blog: 0, podcast: 0, book: 0 },
    total: 0,
    last: null,
    reading: [],
  }));
  const byPerson = new Map(people.map((p) => [p.id, p]));
  const doneBy = new Map<string, string[]>();
  for (const c of completions) {
    const kind = kindOf.get(c.resource_id);
    const person = byPerson.get(c.user_id);
    if (!kind || !person) continue;
    person.done[kind]++;
    person.total++;
    if (!c.is_imported && (!person.last || c.completed_at > person.last)) person.last = c.completed_at;
    doneBy.set(c.resource_id, [...(doneBy.get(c.resource_id) ?? []), person.name]);
  }
  const done = new Set(completions.map((c) => `${c.user_id}:${c.resource_id}`));
  const title = new Map(resources.map((r) => [r.id, r.title]));
  const readingBy = new Map<string, string[]>();
  for (const g of reading) {
    const person = byPerson.get(g.user_id);
    if (kindOf.get(g.resource_id) !== "book" || !person || done.has(`${g.user_id}:${g.resource_id}`)) continue;
    person.reading.push(title.get(g.resource_id)!);
    readingBy.set(g.resource_id, [...(readingBy.get(g.resource_id) ?? []), person.name]);
  }
  for (const p of people) p.reading.sort((a, b) => a.localeCompare(b));
  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const byResource: TeamAcademyResource[] = [...resources]
    .sort((a, b) => a.kind.localeCompare(b.kind) || byNewest(a, b))
    .map((r) => ({
      id: r.id,
      kind: r.kind as ResourceKind,
      title: r.title,
      doneBy: (doneBy.get(r.id) ?? []).sort((a, b) => a.localeCompare(b)),
      readingBy: (readingBy.get(r.id) ?? []).sort((a, b) => a.localeCompare(b)),
    }));

  return { people, byResource, totals };
}
