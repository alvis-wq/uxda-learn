-- Learning paths and imported progress.
--
--  * paths: one card that opens a roadmap of milestone challenges (content/paths/<slug>.yaml, written by content:sync).
--    Content columns are owned by the file; `status` is owned by the admin panel after creation, like a challenge's,
--    and every change after creation goes through set_path_status() with an audit row in path_settings_audit.
--    RLS mirrors challenges_select: published for everyone signed in, drafts for testers whose track can see them.
--  * challenges.path_slug: the path a milestone belongs to (order lives in paths.milestones). Display only: it is not
--    part of content_hash, so moving a challenge into a path never bumps its version.
--  * Locking a milestone (sequential paths) is a progression rule, not a secret: the app checks it on the page and in
--    the submit / draft actions. RLS is unchanged for it.
--  * Imported submissions: progress made before UXDA Learn, entered by an admin (Admin -> Users -> a user) or by
--    scripts/import-path-progress.ts. Stored as a normal real attempt (published, or needs_resubmission) flagged
--    is_imported with who imported it, so points, the leaderboard and the profile work unchanged. Written only by
--    import_submission() and removed only by undo_import(), both audited in submission_import_audit.

-- Paths ----------------------------------------------------------------------------
create table paths (
  slug text primary key,
  category_slug text not null references categories(slug),
  title text not null,
  summary text not null,
  audiences audience[] not null check (public.valid_audiences(audiences)),
  sequential boolean not null default true,
  milestones text[] not null check (cardinality(milestones) >= 2),
  before_you_submit text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table challenges add column path_slug text references paths(slug);
create index challenges_path_slug_idx on challenges (path_slug) where path_slug is not null;

alter table paths enable row level security;
create policy paths_select on paths for select to authenticated
  using (
    status = 'published'
    or public.is_admin()
    or (
      status = 'draft'
      and public.is_tester()
      and public.my_track_sees(audiences)
      and exists (
        select 1 from categories c
        where c.slug = paths.category_slug and not c.archived and public.my_track_sees(c.audiences)
      )
    )
  );
-- No write policies: content:sync and the admin panel write with the service role.
revoke all on paths from anon, authenticated;
grant select on paths to authenticated;
grant all on paths to service_role;

-- Path status + audit ----------------------------------------------------------------
create table path_settings_audit (
  id bigint generated always as identity primary key,
  path_slug text not null references paths(slug) on delete cascade,
  field text not null check (field in ('status')),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in ('admin', 'content:sync')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (source <> 'admin' or changed_by is not null)
);
create index path_settings_audit_slug_idx on path_settings_audit (path_slug, changed_at desc);

alter table path_settings_audit enable row level security;
create policy path_settings_audit_select on path_settings_audit for select to authenticated
  using (public.is_admin());
revoke all on path_settings_audit from anon, authenticated;
grant select on path_settings_audit to authenticated;
grant all on path_settings_audit to service_role;

-- Set a path's status and record old -> new (no row for a no-op). Publishing with p_publish_milestones also publishes
-- every DRAFT milestone of the path in the same transaction, each through set_challenge_setting (so each lands in its
-- challenge's audit log). Placeholder checks happen in the server action first. Returns true when the path changed.
create or replace function public.set_path_status(
  p_slug text,
  p_value text,
  p_source text,
  p_actor uuid default null,
  p_publish_milestones boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old text;
  v_milestones text[];
  v_slug text;
begin
  if p_source = 'admin' and not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change a path''s status' using errcode = '42501';
  end if;
  select status, milestones into v_old, v_milestones from paths where slug = p_slug for update;
  if not found then
    raise exception 'path not found: %', p_slug using errcode = 'P0002';
  end if;

  if p_value = 'published' and p_publish_milestones then
    foreach v_slug in array v_milestones loop
      if exists (select 1 from challenges where slug = v_slug and status = 'draft') then
        perform public.set_challenge_setting(v_slug, 'status', to_jsonb('published'::text), p_source, p_actor);
      end if;
    end loop;
  end if;

  if v_old = p_value then
    return false;
  end if;
  update paths set status = p_value, updated_at = now() where slug = p_slug;
  insert into path_settings_audit (path_slug, field, old_value, new_value, source, changed_by)
    values (p_slug, 'status', to_jsonb(v_old), to_jsonb(p_value), p_source, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_path_status(text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_path_status(text, text, text, uuid, boolean) to service_role;

-- Imported submissions -------------------------------------------------------------------
alter table submissions add column is_imported boolean not null default false;
alter table submissions add column imported_by uuid references profiles(id) on delete set null;
alter table submissions add column imported_at timestamptz;
alter table submissions add constraint submissions_imported_not_test check (not (is_imported and is_test));
alter table submissions add constraint submissions_imported_at check (is_imported = (imported_at is not null));

create table submission_import_audit (
  id bigint generated always as identity primary key,
  -- No foreign key: an undone import's submission no longer exists, and its audit rows must stay.
  submission_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug) on delete cascade,
  action text not null check (action in ('import', 'undo')),
  status submission_status not null,
  final_score numeric not null,
  max_score numeric not null,
  feedback text,
  source text not null check (source in ('admin', 'script')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index submission_import_audit_user_idx on submission_import_audit (user_id, changed_at desc);

alter table submission_import_audit enable row level security;
create policy submission_import_audit_select on submission_import_audit for select to authenticated
  using (public.is_admin());
revoke all on submission_import_audit from anon, authenticated;
grant select on submission_import_audit to authenticated;
grant all on submission_import_audit to service_role;

-- Record progress a user made before UXDA Learn on a path milestone, as their next real attempt. The actor must be an
-- admin; the milestone and its path must be published (imported points count at once, so they must not land on
-- something learners can't see yet); the user's track must see the milestone and its category; and the same rules as
-- a learner's own submit apply (nothing awaiting review, an attempt left, not already at full points). Returns the new
-- submission's id. Service role only.
create or replace function public.import_submission(
  p_user uuid,
  p_challenge text,
  p_status submission_status,
  p_score numeric,
  p_feedback text,
  p_source text,
  p_actor uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ch record;
  v_track track;
  v_used int;
  v_latest submission_status;
  v_best numeric;
  v_id uuid;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can import progress' using errcode = '42501';
  end if;
  if p_status not in ('published', 'needs_resubmission') then
    raise exception 'an import is either done (published) or changes requested (needs_resubmission)' using errcode = '22023';
  end if;

  select c.slug, c.status, c.points, c.version, c.audiences, c.path_slug,
         cat.archived as category_archived, cat.audiences as category_audiences, p.status as path_status
    into ch
    from challenges c
    join categories cat on cat.slug = c.category_slug
    left join paths p on p.slug = c.path_slug
    where c.slug = p_challenge;
  if not found then
    raise exception 'challenge not found: %', p_challenge using errcode = 'P0002';
  end if;
  if ch.path_slug is null then
    raise exception '% is not a path milestone', p_challenge using errcode = '22023';
  end if;
  if ch.status <> 'published' or ch.path_status is distinct from 'published' or ch.category_archived then
    raise exception '% is not published yet: publish the path first', p_challenge using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > ch.points then
    raise exception 'score must be between 0 and %', ch.points using errcode = '22023';
  end if;

  -- Lock the user's profile so two imports (or an import and a submit's insert) can't take the same attempt number.
  select track into v_track from profiles where id = p_user for update;
  if not found then
    raise exception 'user not found: %', p_user using errcode = 'P0002';
  end if;
  if v_track is null
     or not ('all'::audience = any(ch.audiences) or v_track::text::audience = any(ch.audiences))
     or not ('all'::audience = any(ch.category_audiences) or v_track::text::audience = any(ch.category_audiences)) then
    raise exception 'this user''s track can''t see %', p_challenge using errcode = '22023';
  end if;

  select count(*)::int,
         (array_agg(status order by attempt desc))[1],
         max(final_score) filter (where status = 'published')
    into v_used, v_latest, v_best
    from submissions
    where user_id = p_user and challenge_slug = p_challenge and not is_test;
  if v_latest in ('submitted', 'ai_reviewed') then
    raise exception 'an attempt is awaiting review' using errcode = '22023';
  end if;
  if v_used >= 3 then
    raise exception 'all 3 attempts are used' using errcode = '22023';
  end if;
  if v_best is not null and v_best >= ch.points then
    raise exception 'already at full points' using errcode = '22023';
  end if;

  insert into submissions (
    user_id, challenge_slug, challenge_version, attempt, is_test, answers, status, auto_score, final_score,
    max_score, feedback, published_at, is_imported, imported_by, imported_at
  ) values (
    p_user, p_challenge, ch.version, v_used + 1, false, '{}', p_status, 0, p_score,
    ch.points, nullif(btrim(coalesce(p_feedback, '')), ''), now(), true, p_actor, now()
  ) returning id into v_id;

  insert into submission_import_audit (submission_id, user_id, challenge_slug, action, status, final_score, max_score, feedback, source, changed_by)
    values (v_id, p_user, p_challenge, 'import', p_status, p_score, ch.points, nullif(btrim(coalesce(p_feedback, '')), ''), p_source, p_actor);
  return v_id;
end;
$$;

revoke execute on function public.import_submission(uuid, text, submission_status, numeric, text, text, uuid) from public, anon, authenticated;
grant execute on function public.import_submission(uuid, text, submission_status, numeric, text, text, uuid) to service_role;

-- Undo an import: only an imported attempt, and only the user's latest attempt on that challenge (so attempt numbers
-- stay 1, 2, 3 without gaps). The actor must be an admin. Audited. Service role only.
create or replace function public.undo_import(p_submission uuid, p_source text, p_actor uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can undo an import' using errcode = '42501';
  end if;
  select * into s from submissions where id = p_submission for update;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if not s.is_imported then
    raise exception 'only an imported attempt can be undone' using errcode = '22023';
  end if;
  if exists (
    select 1 from submissions
    where user_id = s.user_id and challenge_slug = s.challenge_slug and not is_test and attempt > s.attempt
  ) then
    raise exception 'the user has made a newer attempt since; this import can''t be undone' using errcode = '22023';
  end if;
  delete from submissions where id = p_submission;
  insert into submission_import_audit (submission_id, user_id, challenge_slug, action, status, final_score, max_score, feedback, source, changed_by)
    values (s.id, s.user_id, s.challenge_slug, 'undo', s.status, s.final_score, s.max_score, s.feedback, p_source, p_actor);
end;
$$;

revoke execute on function public.undo_import(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.undo_import(uuid, text, uuid) to service_role;
