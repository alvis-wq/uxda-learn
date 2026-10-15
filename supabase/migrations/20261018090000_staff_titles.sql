-- Staff job titles + one audit log for staff settings (job titles, title emails, tracks).
--
--  * staff_titles is keyed by lowercase email, so a title can be set before someone first signs in. The app joins it
--    to profiles by email (profiles.email is stored lowercase by handle_new_user()).
--  * Every signed-in user can read titles (they show under names). Writes go only through set_staff_title() and
--    rename_staff_email() with the service role: Admin -> Users (server actions check is_admin() first, and the
--    functions check the actor again) and scripts/seed-staff-titles.ts.
--  * staff_audit records every change (old -> new, who, from where). Admin track changes go through set_user_track()
--    so they are audited here too.

create table staff_titles (
  email text primary key
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  job_title text not null check (job_title = btrim(job_title) and char_length(job_title) between 1 and 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

alter table staff_titles enable row level security;
create policy staff_titles_select on staff_titles for select to authenticated using (true);
-- No write policies or grants: written only by the functions below via the service role.
revoke all on staff_titles from anon, authenticated;
grant select on staff_titles to authenticated;
grant all on staff_titles to service_role;

-- Audit ----------------------------------------------------------------------------
create table staff_audit (
  id bigint generated always as identity primary key,
  -- The person's email (for an email change: the new one).
  email text not null,
  field text not null check (field in ('job_title', 'email', 'track')),
  old_value text,
  new_value text,
  -- Who: an admin (changed_by), the seed script, or a data migration (note says which).
  source text not null check (source in ('admin', 'seed', 'migration')),
  changed_by uuid references profiles(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);
create index staff_audit_email_idx on staff_audit (email, changed_at desc);

alter table staff_audit enable row level security;
create policy staff_audit_select on staff_audit for select to authenticated using (public.is_admin());
-- No write policies or grants: written only by the functions below (and data migrations).
revoke all on staff_audit from anon, authenticated;
grant select on staff_audit to authenticated;
grant all on staff_audit to service_role;

create or replace function public.require_admin_actor(p_actor uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change this' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_admin_actor(uuid) from public, anon, authenticated;
grant execute on function public.require_admin_actor(uuid) to service_role;

-- Set (or, with an empty title, remove) the job title for an email, and audit old -> new in one transaction.
-- Source 'admin' needs an admin actor; 'seed' is the seed script. Returns true when something changed.
create or replace function public.set_staff_title(p_email text, p_title text, p_source text, p_actor uuid default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_old text;
begin
  if p_source = 'admin' then
    perform public.require_admin_actor(p_actor);
  elsif p_source <> 'seed' then
    raise exception 'unknown source: %', p_source using errcode = '22023';
  end if;

  select job_title into v_old from staff_titles where email = v_email for update;
  if v_old is not distinct from v_title then
    return false;
  end if;

  if v_title is null then
    delete from staff_titles where email = v_email;
  else
    insert into staff_titles (email, job_title, updated_at, updated_by)
      values (v_email, v_title, now(), p_actor)
      on conflict (email) do update
        set job_title = excluded.job_title, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;

  insert into staff_audit (email, field, old_value, new_value, source, changed_by)
    values (v_email, 'job_title', v_old, v_title, p_source, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_staff_title(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_staff_title(text, text, text, uuid) to service_role;

-- Fix a seeded email that nobody has signed in with yet (a signed-in person's email comes from Google).
-- Admin only. Returns true when it changed.
create or replace function public.rename_staff_email(p_old text, p_new text, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old text := lower(btrim(p_old));
  v_new text := lower(btrim(p_new));
begin
  perform public.require_admin_actor(p_actor);
  if v_old = v_new then
    return false;
  end if;
  if exists (select 1 from profiles where email = v_old) then
    raise exception 'someone has signed in with %; their email can''t be changed here', v_old using errcode = '42501';
  end if;
  if exists (select 1 from staff_titles where email = v_new) then
    raise exception 'a title already exists for %', v_new using errcode = '23505';
  end if;

  update staff_titles set email = v_new, updated_at = now(), updated_by = p_actor where email = v_old;
  if not found then
    raise exception 'no title for %', v_old using errcode = 'P0002';
  end if;

  insert into staff_audit (email, field, old_value, new_value, source, changed_by)
    values (v_new, 'email', v_old, v_new, 'admin', p_actor);
  return true;
end;
$$;

revoke execute on function public.rename_staff_email(text, text, uuid) from public, anon, authenticated;
grant execute on function public.rename_staff_email(text, text, uuid) to service_role;

-- Change a user's track from Admin -> Users and audit old -> new in one transaction. Admin only. Which tracks can be
-- chosen is checked in the server action. Returns true when it changed.
create or replace function public.set_user_track(p_user uuid, p_track track, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old track;
  v_email text;
begin
  perform public.require_admin_actor(p_actor);
  select track, email into v_old, v_email from profiles where id = p_user for update;
  if not found then
    raise exception 'user not found: %', p_user using errcode = 'P0002';
  end if;
  if v_old is not distinct from p_track then
    return false;
  end if;

  update profiles set track = p_track where id = p_user;
  insert into staff_audit (email, field, old_value, new_value, source, changed_by)
    values (v_email, 'track', v_old::text, p_track::text, 'admin', p_actor);
  return true;
end;
$$;

revoke execute on function public.set_user_track(uuid, track, uuid) from public, anon, authenticated;
grant execute on function public.set_user_track(uuid, track, uuid) to service_role;
