import { RESOURCE_KINDS, byNewest, type ResourceKind } from "@/lib/academy/resources";

export type TeamAcademyInput = {
  members: { id: string; full_name: string | null }[];
  resources: { id: string; kind: string; title: string; sort_key: number }[];
  completions: { user_id: string; resource_id: string; completed_at: string; is_imported: boolean }[];
};

export type TeamAcademyPerson = { id: string; name: string; done: Record<ResourceKind, number>; total: number; last: string | null };
export type TeamAcademyResource = { id: string; kind: ResourceKind; title: string; doneBy: string[] };

/**
 * The Team page's Academy view: per person how many blog posts, podcasts and books they've completed (and when they
 * last completed one), and per resource who has. Only published resources (the caller passes those) count.
 */
export function buildTeamAcademy({ members, resources, completions }: TeamAcademyInput) {
  const kindOf = new Map(resources.map((r) => [r.id, r.kind as ResourceKind]));
  const names = new Map(members.map((m) => [m.id, m.full_name?.trim() || "Unnamed"]));
  const totals = Object.fromEntries(RESOURCE_KINDS.map((k) => [k, resources.filter((r) => r.kind === k).length])) as Record<ResourceKind, number>;

  const people: TeamAcademyPerson[] = members.map((m) => ({
    id: m.id,
    name: names.get(m.id)!,
    done: { blog: 0, podcast: 0, book: 0 },
    total: 0,
    last: null,
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
  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const byResource: TeamAcademyResource[] = [...resources]
    .sort((a, b) => a.kind.localeCompare(b.kind) || byNewest(a, b))
    .map((r) => ({ id: r.id, kind: r.kind as ResourceKind, title: r.title, doneBy: (doneBy.get(r.id) ?? []).sort((a, b) => a.localeCompare(b)) }));

  return { people, byResource, totals };
}
