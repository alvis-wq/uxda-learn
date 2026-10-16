-- UXDA Learn — database spec (current state). Migrations in supabase/migrations are the
-- source of truth for how the live DB got here; keep this file in step with them.

-- account_manager and assistant are no longer offered (src/lib/tracks.ts: selectable: false); everyone on them moved to
-- management (20261018100000_simpler_tracks.sql, audited in staff_audit). The values stay for old content and history.
create type track as enum ('strategist', 'designer', 'account_manager', 'assistant', 'motion_designer', 'management');
create type audience as enum ('all', 'strategist', 'designer', 'account_manager', 'assistant', 'motion_designer', 'management');
create type challenge_type as enum ('quiz', 'screenshot', 'figma', 'mixed', 'acknowledge');
create type submission_status as enum
  ('submitted', 'ai_reviewed', 'published', 'needs_resubmission');

create table admin_allowlist (email text primary key);

-- Synced from ALLOWED_EMAIL_DOMAINS by `npm run seed:domains`; checked by handle_new_user.
create table allowed_email_domains (
  domain text primary key
    check (domain = lower(domain) and domain ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$')
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  track track,
  is_admin boolean not null default false,
  -- Can see and take DRAFT challenges their track can see (RLS: challenges_select); service role sets it, audited.
  is_tester boolean not null default false,
  show_on_leaderboard boolean not null default true,
  created_at timestamptz not null default now()
);

-- Exactly {all}, or one or more distinct tracks.
create or replace function public.valid_audiences(a audience[]) returns boolean
language sql immutable set search_path = public as $$
  select a is not null
     and cardinality(a) >= 1
     and (a = array['all']::audience[] or not ('all' = any(a)))
     and cardinality(a) = (select count(distinct x) from unnest(a) as x);
$$;

create table categories (
  slug text primary key,
  title text not null,
  description text,
  audiences audience[] not null check (public.valid_audiences(audiences)),
  sort_order int not null default 0,
  archived boolean not null default false,
  -- File name in public/challenges/ (card artwork); display only.
  image text check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$')
);

-- A learning path: one card that opens a roadmap of milestone challenges (content/paths/<slug>.yaml). Content columns
-- come from the file; status, required_for and due_at are owned by the admin panel after creation (set_path_status /
-- set_path_setting, audited).
create table paths (
  slug text primary key,
  category_slug text not null references categories(slug),
  title text not null,
  summary text not null,
  audiences audience[] not null check (public.valid_audiences(audiences)),
  -- Each milestone unlocks once the one before it has any attempt (awaiting review counts).
  sequential boolean not null default true,
  milestones text[] not null check (cardinality(milestones) >= 2),   -- challenge slugs, in order
  before_you_start text check (before_you_start is null or char_length(before_you_start) <= 600),  -- markdown box at the top
  before_you_submit text[] not null default '{}',
  -- Card artwork: a file name in public/challenges/ (else the category's). Display only.
  image text check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$'),
  -- Hand tuning of the illustration (scale anchored bottom-right; offsets in % of its size); display only.
  image_scale numeric not null default 1 check (image_scale between 0.5 and 2),
  image_offset_x numeric not null default 0 check (image_offset_x between -50 and 50),
  image_offset_y numeric not null default 0 check (image_offset_y between -50 and 50),
  -- Path slugs that come first: this path stays locked until each has every milestone submitted (any attempt counts).
  requires text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Admin-owned like status (set_path_setting, audited). A required path is ONE required item; milestones never are.
  required_for audience[] not null default '{}'
    check (cardinality(required_for) = 0 or public.valid_audiences(required_for)),
  due_at timestamptz,
  -- Featured on home, like a challenge's (admin-owned, set_path_setting / move_featured).
  featured_for audience[] not null default '{}' check (cardinality(featured_for) = 0 or public.valid_audiences(featured_for)),
  featured_at timestamptz,
  constraint paths_featured_at check ((cardinality(featured_for) = 0) = (featured_at is null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table challenges (
  slug text primary key,
  category_slug text not null references categories(slug),
  title text not null,
  summary text,
  body_md text not null,
  type challenge_type not null,
  audiences audience[] not null check (public.valid_audiences(audiences)),
  -- Empty = optional for everyone.
  required_for audience[] not null default '{}'
    check (cardinality(required_for) = 0 or public.valid_audiences(required_for)),
  difficulty smallint not null check (difficulty between 1 and 3),
  -- Acknowledge challenges are worth 0 points; everything else > 0.
  points int not null check (points >= 0 and ((type = 'acknowledge') = (points = 0))),
  estimated_minutes int,
  -- Part of estimated_minutes spent waiting while Claude Code works; hands-on = estimated - waiting (not stored).
  waiting_minutes int
    check (waiting_minutes is null or (waiting_minutes >= 0 and estimated_minutes is not null and waiting_minutes <= estimated_minutes)),
  questions jsonb not null default '[]',        -- WITHOUT answers
  submission_spec jsonb not null default '{}',
  rubric jsonb not null default '[]',           -- criteria shown to users
  -- final: results after submit. instant: each answer checked on the server as the learner goes (one real attempt).
  feedback_mode text not null default 'final' check (feedback_mode in ('final', 'instant')),
  version int not null default 1,
  content_hash text not null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  due_at timestamptz,
  -- File name in public/challenges/ (card artwork); display only, not part of content_hash.
  image text check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$'),
  -- Hand tuning of the illustration (scale anchored bottom-right; offsets in % of its size); display only.
  image_scale numeric not null default 1 check (image_scale between 0.5 and 2),
  image_offset_x numeric not null default 0 check (image_offset_x between -50 and 50),
  image_offset_y numeric not null default 0 check (image_offset_y between -50 and 50),
  -- Short markdown hint above the questions; display only, not part of content_hash.
  tip text check (tip is null or char_length(tip) <= 1000),
  -- {url, label}: source material offered after a wrong answer in instant mode (https only); display only, not part
  -- of content_hash. Full check: supabase/migrations/20261024090000_help_link.sql.
  help_link jsonb check (help_link is null or (jsonb_typeof(help_link) = 'object' and help_link - 'url' - 'label' = '{}'::jsonb
    and help_link ->> 'url' ~ '^https://[^[:space:]]+$' and char_length(help_link ->> 'url') <= 2000
    and char_length(help_link ->> 'label') between 1 and 120)),
  -- The path this challenge is a milestone of (listed only inside it); display only, not part of content_hash.
  path_slug text references paths(slug),
  -- Admin-owned (never in content files): the tracks it's featured for on the home page ('{}' = not), and when
  -- (the "Featured" order, oldest first; move_featured swaps it). A milestone is never featured (set_challenge_setting).
  featured_for audience[] not null default '{}' check (cardinality(featured_for) = 0 or public.valid_audiences(featured_for)),
  featured_at timestamptz,
  constraint challenges_featured_at check ((cardinality(featured_for) = 0) = (featured_at is null)),
  updated_at timestamptz not null default now()
);

-- Private: answers, explanations + grader notes. No RLS policies => service role only.
create table challenge_keys (
  challenge_slug text primary key references challenges(slug) on delete cascade,
  answer_key jsonb not null default '{}',
  -- Question id -> why the right answer is right; shown only once the learner has it right (or may see the key).
  explanations jsonb not null default '{}'
    check (jsonb_typeof(explanations) = 'object' and octet_length(explanations::text) <= 200000),
  grader_notes text
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  challenge_version int not null,
  attempt int not null default 1,
  answers jsonb not null default '{}',
  image_paths text[] not null default '{}',
  figma_url text,
  reflection text,
  status submission_status not null default 'submitted',
  auto_score numeric not null default 0,
  final_score numeric,
  max_score numeric not null,
  feedback text,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  -- An attempt on a draft challenge by a tester: never counts (points, leaderboard, completed, required, the
  -- 3-attempt limit) and is numbered on its own. Its owner reads it only while the challenge is a draft.
  is_test boolean not null default false,
  -- Progress made before UXDA Learn, entered by an admin (import_submission). A normal real attempt otherwise.
  is_imported boolean not null default false,
  imported_by uuid references profiles(id) on delete set null,
  imported_at timestamptz,
  -- Instant mode: tries per question id behind the score ({"q1": 1, "q2": 3}); null in final mode.
  question_tries jsonb
    check (question_tries is null or (jsonb_typeof(question_tries) = 'object' and octet_length(question_tries::text) <= 50000)),
  constraint submissions_imported_not_test check (not (is_imported and is_test)),
  constraint submissions_imported_at check (is_imported = (imported_at is not null)),
  constraint submissions_attempt_range check (attempt >= 1 and (is_test or attempt <= 3)),
  unique (user_id, challenge_slug, is_test, attempt)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  batch_id text not null,
  criteria jsonb not null,           -- [{id, score, max, evidence, comment}]
  total numeric not null,
  feedback text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  flags text[] not null default '{}',
  model text,
  created_at timestamptz not null default now(),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  unique (submission_id, batch_id)
);

-- "I've read and understood" for acknowledge challenges. Separate from submissions so they
-- never count towards scores, the leaderboard or the review queue.
create table acknowledgements (
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  challenge_version int not null,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, challenge_slug)
);

-- A learner's in-progress answers (Stepper state), so they can continue later from any device. Deleted on submit.
-- Written by the user's own session under RLS (own rows only; admins have no access), except instant_tries.
create table submission_drafts (
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  challenge_version int not null,
  answers jsonb not null default '{}',
  figma_url text,
  reflection text,
  image_paths text[] not null default '{}',
  current_step int not null default 1,
  updated_at timestamptz not null default now(),
  -- Instant mode: the run in progress, {"test": bool, "questions": {"<id>": {"tries": n, "solved": bool}}}. Written
  -- only by record_instant_try (service role): the learner can't write it or delete a row that has it.
  instant_tries jsonb
    check (instant_tries is null or (jsonb_typeof(instant_tries) = 'object' and octet_length(instant_tries::text) <= 50000)),
  primary key (user_id, challenge_slug),
  check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 200000),
  check (current_step between 1 and 100),
  check (figma_url is null or char_length(figma_url) <= 2000),
  check (reflection is null or char_length(reflection) <= 20000),
  check (cardinality(image_paths) <= 10)
);

-- Who changed a challenge's admin-owned settings (status, required_for, due_at), and when.
-- Written only by set_challenge_setting(): the admin panel, or content:sync archiving a
-- challenge whose file was removed.
create table challenge_settings_audit (
  id bigint generated always as identity primary key,
  challenge_slug text not null references challenges(slug) on delete cascade,
  field text not null check (field in ('status', 'required_for', 'due_at', 'featured_for', 'featured_order')),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in ('admin', 'content:sync')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (source <> 'admin' or changed_by is not null)
);
create index challenge_settings_audit_slug_idx on challenge_settings_audit (challenge_slug, changed_at desc);

-- Who changed a user's flag (today: the tester switch on Admin → Users). Written only by set_user_tester().
create table profile_flag_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  field text not null check (field in ('is_tester')),
  old_value boolean,
  new_value boolean not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index profile_flag_audit_profile_idx on profile_flag_audit (profile_id, changed_at desc);

-- Job titles shown under names, keyed by lowercase email (works before someone's first sign-in; joined to profiles by
-- email). Signed-in users read them; written only by set_staff_title() / rename_staff_email() (service role).
create table staff_titles (
  email text primary key
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  job_title text not null check (job_title = btrim(job_title) and char_length(job_title) between 1 and 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

-- Every change to a job title, a title's email or a user's track (Admin → Users, the seed script, data migrations).
create table staff_audit (
  id bigint generated always as identity primary key,
  email text not null,   -- the person's email (for an email change: the new one)
  field text not null check (field in ('job_title', 'email', 'track')),
  old_value text,
  new_value text,
  source text not null check (source in ('admin', 'seed', 'migration')),
  changed_by uuid references profiles(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);
create index staff_audit_email_idx on staff_audit (email, changed_at desc);

-- Notes from testers on a draft challenge. Admin read only; written by a server action (service role).
create table challenge_feedback (
  id uuid primary key default gen_random_uuid(),
  challenge_slug text not null references challenges(slug) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index challenge_feedback_slug_idx on challenge_feedback (challenge_slug, created_at desc);

-- Who changed a path's status, required_for or due_at, and when. Written only by set_path_status() / set_path_setting().
create table path_settings_audit (
  id bigint generated always as identity primary key,
  path_slug text not null references paths(slug) on delete cascade,
  field text not null check (field in ('status', 'required_for', 'due_at', 'featured_for', 'featured_order')),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in ('admin', 'content:sync')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (source <> 'admin' or changed_by is not null)
);

-- Every import and undo of imported progress. Written only by import_submission() / undo_import().
create table submission_import_audit (
  id bigint generated always as identity primary key,
  submission_id uuid not null,                      -- no FK: an undone import's row is gone
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

-- Helpers ------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_tester() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_tester from profiles where id = auth.uid()), false);
$$;

-- Does the signed-in user's track appear in this audience list ('all' = everyone)?
create or replace function public.my_track_sees(a audience[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.track is not null
      and ('all'::audience = any(a) or p.track::text::audience = any(a))
  );
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from allowed_email_domains d
    where d.domain = split_part(lower(new.email), '@', 2)
  ) then
    raise exception 'Email domain is not allowed';
  end if;
  insert into profiles (id, email, full_name, avatar_url, is_admin)
  values (
    new.id, lower(new.email),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    exists (select 1 from admin_allowlist a where a.email = lower(new.email))
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Groups of tracks are configured in src/lib/tracks.ts (LEADERBOARD_GROUPS).
create or replace function public.get_leaderboard(p_tracks track[])
returns table (user_id uuid, full_name text, avatar_url text, track track, total_score numeric, completed int)
language sql stable security definer set search_path = public as $$
  with best as (
    select s.user_id, s.challenge_slug, max(s.final_score) as score
    from submissions s
    where s.status = 'published' and not s.is_test
    group by s.user_id, s.challenge_slug
  )
  select p.id, p.full_name, p.avatar_url, p.track,
         coalesce(sum(b.score), 0) as total_score,
         count(b.challenge_slug)::int as completed
  from profiles p
  left join best b on b.user_id = p.id
  where p.track = any(p_tracks) and p.show_on_leaderboard
  group by p.id
  order by total_score desc, completed desc;
$$;

-- Sets one of status / required_for / due_at and writes the audit row in the same transaction.
-- No-op (returns false, no audit row) when the value doesn't change. Service role only; the
-- server action validates first (visible tracks, no TODO placeholders when publishing).
-- Full body: supabase/migrations/20261011090000_challenge_settings_audit.sql
-- function public.set_challenge_setting(p_slug text, p_field text, p_value jsonb,
--                                       p_source text, p_actor uuid default null) returns boolean
-- revoke execute ... from public, anon, authenticated; grant execute ... to service_role;

-- Sets profiles.is_tester and writes the profile_flag_audit row in one transaction; the actor must be an admin.
-- No-op (returns false, no audit row) when the value doesn't change. Service role only.
-- Full body: supabase/migrations/20261014100000_testers.sql
-- function public.set_user_tester(p_user uuid, p_value boolean, p_actor uuid) returns boolean

-- Staff titles and tracks. Full bodies: supabase/migrations/20261018090000_staff_titles.sql. All service role only; each
-- writes a staff_audit row and is a no-op (returns false, no audit row) when nothing changes.
-- set_staff_title(p_email, p_title, p_source, p_actor): set, or with an empty title remove; source 'admin' (actor must be
--   an admin) or 'seed' (scripts/seed-staff-titles.ts).
-- rename_staff_email(p_old, p_new, p_actor): fix a seeded email nobody has signed in with; actor must be an admin.
-- set_user_track(p_user, p_track, p_actor): Admin → Users track change; actor must be an admin.

-- Paths and imports. Full bodies: supabase/migrations/20261015090000_learning_paths.sql. All service role only.
-- set_path_status(p_slug, p_value, p_source, p_actor, p_publish_milestones): status + audit row (none for a no-op);
--   publishing with p_publish_milestones also publishes the path's draft milestones via set_challenge_setting.
-- set_path_setting(p_slug, p_field, p_value, p_source, p_actor): required_for or due_at + audit row (none for a no-op);
--   actor must be an admin for source 'admin'. Body: supabase/migrations/20261020090000_path_required_due.sql.
-- import_submission(p_user, p_challenge, p_status, p_score, p_feedback, p_source, p_actor) returns uuid: the next real
--   attempt on a published milestone of a published path, flagged is_imported; actor must be an admin; same limits as
--   a submit (nothing awaiting review, an attempt left, not at full points); audited.
-- undo_import(p_submission, p_source, p_actor): deletes an imported attempt that is the user's latest; audited.
-- set_challenge_setting / set_path_setting also take 'featured_for' (featuring stamps featured_at, un-featuring clears
--   it, changing tracks keeps it; a milestone is refused). Body: supabase/migrations/20261025090000_featured.sql.
-- move_featured(p_kind, p_slug, p_direction, p_actor) returns boolean: swaps a featured challenge's or path's place in
--   the home order with its neighbour; both moves audited as 'featured_order'. Admin only.
-- record_instant_try(p_user, p_challenge, p_version, p_question, p_correct, p_is_test) returns jsonb: counts one check
--   of one question in the learner's instant run (atomic; a solved question is never counted again; a run of the other
--   kind, test or real, is discarded first). Service role only.
--   Body: supabase/migrations/20261023090000_instant_quiz.sql.

-- RLS ----------------------------------------------------------------------
alter table admin_allowlist enable row level security;   -- no policies
alter table allowed_email_domains enable row level security;   -- no policies
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table challenges      enable row level security;
alter table challenge_keys  enable row level security;   -- no policies
alter table submissions     enable row level security;
alter table evaluations     enable row level security;
alter table acknowledgements enable row level security;
alter table challenge_settings_audit enable row level security;
alter table submission_drafts enable row level security;
alter table profile_flag_audit enable row level security;
alter table challenge_feedback enable row level security;
alter table staff_titles enable row level security;
alter table staff_audit enable row level security;

create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (show_on_leaderboard) on profiles to authenticated;

create policy categories_select on categories for select to authenticated
  using (not archived or public.is_admin());

-- Testers also see DRAFT challenges that their track can see (the challenge's and its category's audiences, category
-- not archived). Archived stays hidden from them.
create policy challenges_select on challenges for select to authenticated
  using (
    status = 'published'
    or public.is_admin()
    or (
      status = 'draft'
      and public.is_tester()
      and public.my_track_sees(audiences)
      and exists (
        select 1 from categories c
        where c.slug = challenges.category_slug and not c.archived and public.my_track_sees(c.audiences)
      )
    )
  );

-- A user's TEST attempts are readable by them only while the challenge is a draft (after publishing they start fresh).
create policy submissions_select on submissions for select to authenticated
  using (
    public.is_admin()
    or (
      user_id = auth.uid()
      and (
        not is_test
        or exists (select 1 from challenges c where c.slug = submissions.challenge_slug and c.status = 'draft')
      )
    )
  );
-- No insert/update policies: all writes via server actions with service role.

create policy evaluations_select on evaluations for select to authenticated
  using (public.is_admin());

create policy acknowledgements_select on acknowledgements for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies or grants: written by a server action with the service role.

create policy challenge_settings_audit_select on challenge_settings_audit for select to authenticated
  using (public.is_admin());
-- No write policies or grants: written only by set_challenge_setting() (service role).

create policy profile_flag_audit_select on profile_flag_audit for select to authenticated using (public.is_admin());
-- No write policies or grants: written only by set_user_tester() (service role, actor must be an admin).

create policy challenge_feedback_select on challenge_feedback for select to authenticated using (public.is_admin());
-- No write policies or grants: written by a server action (service role) for testers on a draft they can see.

create policy staff_titles_select on staff_titles for select to authenticated using (true);
-- No write policies or grants: written only by set_staff_title() / rename_staff_email() (service role).

create policy staff_audit_select on staff_audit for select to authenticated using (public.is_admin());
-- No write policies or grants: written only by the staff functions and data migrations.

-- Paths: same rule as challenges_select (published; drafts for testers whose track and category can see them).
create policy paths_select on paths for select to authenticated
  using (
    status = 'published'
    or public.is_admin()
    or (
      status = 'draft' and public.is_tester() and public.my_track_sees(audiences)
      and exists (select 1 from categories c
                  where c.slug = paths.category_slug and not c.archived and public.my_track_sees(c.audiences))
    )
  );
-- No write policies: content:sync and the admin panel write with the service role.

create policy path_settings_audit_select on path_settings_audit for select to authenticated using (public.is_admin());
create policy submission_import_audit_select on submission_import_audit for select to authenticated using (public.is_admin());
-- No write policies or grants: written only by set_path_status() / import_submission() / undo_import().

-- Own rows only, read and write; no is_admin() clause, so admins can't see or edit drafts either.
create policy submission_drafts_select on submission_drafts for select to authenticated using (user_id = auth.uid());
create policy submission_drafts_insert on submission_drafts for insert to authenticated with check (user_id = auth.uid());
create policy submission_drafts_update on submission_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- A draft holding an instant run can't be deleted by its owner (that would reset the tries).
create policy submission_drafts_delete on submission_drafts for delete to authenticated
  using (user_id = auth.uid() and instant_tries is null);
revoke all on submission_drafts from anon, authenticated;
-- Every column but instant_tries.
grant select, delete on submission_drafts to authenticated;
grant insert (user_id, challenge_slug, challenge_version, answers, figma_url, reflection, image_paths, current_step, updated_at)
  on submission_drafts to authenticated;
grant update (user_id, challenge_slug, challenge_version, answers, figma_url, reflection, image_paths, current_step, updated_at)
  on submission_drafts to authenticated;

-- Storage ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 10485760,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy submissions_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy submissions_read_own_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'submissions'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
