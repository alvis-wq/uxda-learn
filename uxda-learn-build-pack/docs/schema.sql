-- UXDA Learn — database spec. Turn into a migration in Phase 1.

create type track as enum ('strategist', 'designer');
create type audience as enum ('all', 'strategist', 'designer');
create type challenge_type as enum ('quiz', 'screenshot', 'figma', 'mixed');
create type submission_status as enum
  ('submitted', 'ai_reviewed', 'published', 'needs_resubmission');

create table admin_allowlist (email text primary key);

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

create table categories (
  slug text primary key,
  title text not null,
  description text,
  audience audience not null,
  sort_order int not null default 0,
  archived boolean not null default false
);

create table challenges (
  slug text primary key,
  category_slug text not null references categories(slug),
  title text not null,
  summary text,
  body_md text not null,
  type challenge_type not null,
  audience audience not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  points int not null check (points > 0),
  estimated_minutes int,
  questions jsonb not null default '[]',        -- WITHOUT answers
  submission_spec jsonb not null default '{}',
  rubric jsonb not null default '[]',           -- criteria shown to users
  version int not null default 1,
  content_hash text not null,
  status text not null default 'published' check (status in ('draft','published','archived')),
  due_at timestamptz,
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

-- Helpers ------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if split_part(lower(new.email), '@', 2) <> 'theuxda.com' then
    raise exception 'Only @theuxda.com accounts are allowed';
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

create or replace function public.get_leaderboard(p_track track)
returns table (user_id uuid, full_name text, avatar_url text, total_score numeric, completed int)
language sql stable security definer set search_path = public as $$
  with best as (
    select s.user_id, s.challenge_slug, max(s.final_score) as score
    from submissions s
    where s.status = 'published'
    group by s.user_id, s.challenge_slug
  )
  select p.id, p.full_name, p.avatar_url,
         coalesce(sum(b.score), 0) as total_score,
         count(b.challenge_slug)::int as completed
  from profiles p
  left join best b on b.user_id = p.id
  where p.track = p_track and p.show_on_leaderboard
  group by p.id
  order by total_score desc, completed desc;
$$;

-- RLS ----------------------------------------------------------------------
alter table admin_allowlist enable row level security;   -- no policies
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table challenges      enable row level security;
alter table challenge_keys  enable row level security;   -- no policies
alter table submissions     enable row level security;
alter table evaluations     enable row level security;

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
