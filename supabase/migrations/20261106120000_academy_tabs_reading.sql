-- UXDA Academy: podcast release dates and "Reading now" for books.
--
--  * academy_resources.released_on: when a podcast episode (or blog post) came out. Podcasts are listed newest release
--    first. Filled from the podcast's RSS feed by scripts/import-podcasts.ts --dates, or by an editor.
--  * academy_reading: books a person is reading now. Their own marker, set and cleared by them (server action with the
--    service role after the session user is checked), cleared when they complete the book. Leads and admins read
--    everyone's through team_academy_reading().

alter table academy_resources add column released_on date;

create index academy_resources_released on academy_resources (kind, released_on desc nulls last) where status = 'published';

create table academy_reading (
  user_id uuid not null references profiles(id) on delete cascade,
  resource_id uuid not null references academy_resources(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index academy_reading_resource on academy_reading (resource_id);

-- Only books can be "reading now".
create or replace function public.academy_check_reading_book() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from academy_resources where id = new.resource_id and kind = 'book') then
    raise exception 'only a book can be marked as reading now' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger academy_reading_book before insert or update of resource_id on academy_reading
  for each row execute function public.academy_check_reading_book();

alter table academy_reading enable row level security;

create policy academy_reading_select on academy_reading for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on academy_reading from anon, authenticated;
grant select on academy_reading to authenticated;
grant all on academy_reading to service_role;

-- Team view (leads and admins): who is reading which published book, since when.
create or replace function public.team_academy_reading()
returns table (user_id uuid, resource_id uuid, started_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_lead()) then
    raise exception 'only leads and admins can see team progress' using errcode = '42501';
  end if;
  return query
    select g.user_id, g.resource_id, g.started_at
    from academy_reading g
    join academy_resources r on r.id = g.resource_id
    where r.status = 'published';
end;
$$;

revoke execute on function public.team_academy_reading() from public, anon;
grant execute on function public.team_academy_reading() to authenticated, service_role;
