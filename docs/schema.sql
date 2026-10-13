-- UXDA Learn — database spec (current state). Migrations in supabase/migrations are the
-- source of truth for how the live DB got here; keep this file in step with them.

create type track as enum ('strategist', 'designer', 'account_manager', 'assistant', 'motion_designer');
create type audience as enum ('all', 'strategist', 'designer', 'account_manager', 'assistant', 'motion_designer');
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
  questions jsonb not null default '[]',        -- WITHOUT answers
  submission_spec jsonb not null default '{}',
  rubric jsonb not null default '[]',           -- criteria shown to users
  version int not null default 1,
  content_hash text not null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  due_at timestamptz,
  -- File name in public/challenges/ (card artwork); display only, not part of content_hash.
  image text check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$'),
  -- Short markdown hint above the questions; display only, not part of content_hash.
  tip text check (tip is null or char_length(tip) <= 1000),
  updated_at timestamptz not null default now()
);

-- Private: answers + grader notes. No RLS policies => service role only.
create table challenge_keys (
  challenge_slug text primary key references challenges(slug) on delete cascade,
  answer_key jsonb not null default '{}',
  grader_notes text
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  challenge_version int not null,
  attempt int not null default 1 check (attempt between 1 and 3),
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
  unique (user_id, challenge_slug, attempt)
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
-- Written by the user's own session under RLS (own rows only; admins have no access).
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
  field text not null check (field in ('status', 'required_for', 'due_at')),
  old_value jsonb,
  new_value jsonb,
  source text not null check (source in ('admin', 'content:sync')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (source <> 'admin' or changed_by is not null)
);
create index challenge_settings_audit_slug_idx on challenge_settings_audit (challenge_slug, changed_at desc);

-- Helpers ------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
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
    where s.status = 'published'
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

create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (show_on_leaderboard) on profiles to authenticated;

create policy categories_select on categories for select to authenticated
  using (not archived or public.is_admin());

create policy challenges_select on challenges for select to authenticated
  using (status = 'published' or public.is_admin());

create policy submissions_select on submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies: all writes via server actions with service role.

create policy evaluations_select on evaluations for select to authenticated
  using (public.is_admin());

create policy acknowledgements_select on acknowledgements for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies or grants: written by a server action with the service role.

create policy challenge_settings_audit_select on challenge_settings_audit for select to authenticated
  using (public.is_admin());
-- No write policies or grants: written only by set_challenge_setting() (service role).

-- Own rows only, read and write; no is_admin() clause, so admins can't see or edit drafts either.
create policy submission_drafts_select on submission_drafts for select to authenticated using (user_id = auth.uid());
create policy submission_drafts_insert on submission_drafts for insert to authenticated with check (user_id = auth.uid());
create policy submission_drafts_update on submission_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy submission_drafts_delete on submission_drafts for delete to authenticated using (user_id = auth.uid());
revoke all on submission_drafts from anon, authenticated;
grant select, insert, update, delete on submission_drafts to authenticated;

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
