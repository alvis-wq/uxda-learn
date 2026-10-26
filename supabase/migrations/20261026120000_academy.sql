-- UXDA Academy: blog posts, podcast episodes and books everyone is meant to read or listen to. A person marks one done by
-- passing its 5-question quiz (4 of 5 right). Separate from challenges, points and the leaderboard.
--
--  * profiles.is_academy_editor: can add and edit Academy resources and their quizzes (admins can anyway). Service role
--    sets it, audited in profile_flag_audit by set_user_academy_editor().
--  * academy_resources holds the questions WITHOUT answers; the answers are in academy_quiz_keys (no policies, service
--    role only), like challenges / challenge_keys.
--  * Every write (resources, keys, completions, attempts) goes through server actions with the service role after the
--    session user is checked. Clients only read.
--  * Leads and admins read everyone's completions through team_academy(); RLS on completions stays own-rows-or-admin.

-- Academy editor flag ---------------------------------------------------------------------
alter table profiles add column is_academy_editor boolean not null default false;
-- `authenticated` can only update show_on_leaderboard (see init), so is_academy_editor is service-role only.

create or replace function public.is_academy_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_academy_editor from profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_academy_editor() from public, anon;
grant execute on function public.is_academy_editor() to authenticated, service_role;

alter table profile_flag_audit drop constraint profile_flag_audit_field_check;
alter table profile_flag_audit add constraint profile_flag_audit_field_check
  check (field in ('is_tester', 'is_lead', 'is_academy_editor'));

-- Same contract as set_user_lead: admin actor only, returns true when the value changed, one audit row per change.
create or replace function public.set_user_academy_editor(p_user uuid, p_value boolean, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old boolean;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change the academy editor flag' using errcode = '42501';
  end if;
  select is_academy_editor into v_old from profiles where id = p_user for update;
  if not found then
    raise exception 'user not found: %', p_user using errcode = 'P0002';
  end if;
  if v_old = p_value then
    return false;
  end if;
  update profiles set is_academy_editor = p_value where id = p_user;
  insert into profile_flag_audit (profile_id, field, old_value, new_value, changed_by)
    values (p_user, 'is_academy_editor', v_old, p_value, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_user_academy_editor(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_user_academy_editor(uuid, boolean, uuid) to service_role;

-- Resources -----------------------------------------------------------------------------
create table academy_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('blog', 'podcast', 'book')),
  title text not null check (length(btrim(title)) > 0),
  url text check (url is null or url ~ '^https?://'),
  description text,
  -- Path inside the public `academy` bucket (thumbnail or book cover), or null.
  image_path text,
  author text,
  -- Blog: the blog's own category (Strategy, UX Trends…). Book: 'academy' (UXDA Academy) or 'other' (other insightful).
  category text,
  -- Blog number / podcast episode number / book number from the old spreadsheet, when known.
  number int,
  -- A podcast episode about a blog post: shown in the same row as that post. One episode per post.
  blog_id uuid references academy_resources(id) on delete restrict,
  questions jsonb not null default '[]',   -- WITHOUT answers
  quiz_reviewed boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- Newest first. New rows get the current epoch; the spreadsheet import uses the old row number, so imported rows keep
  -- their order and sit below anything added later.
  sort_key bigint not null default extract(epoch from now())::bigint,
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (blog_id is null or kind = 'podcast'),
  check (category is null or kind <> 'book' or category in ('academy', 'other')),
  -- Nothing goes live without a full quiz.
  check (status <> 'published' or jsonb_array_length(questions) = 5)
);

create unique index academy_resources_one_podcast_per_blog on academy_resources (blog_id) where blog_id is not null;
create unique index academy_resources_url on academy_resources (url) where url is not null;
create index academy_resources_list on academy_resources (kind, status, sort_key desc);

-- A podcast can only point at a blog post.
create or replace function public.academy_check_blog_link() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.blog_id is not null and not exists (select 1 from academy_resources where id = new.blog_id and kind = 'blog') then
    raise exception 'a podcast can only be linked to a blog post' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger academy_resources_blog_link before insert or update of blog_id on academy_resources
  for each row execute function public.academy_check_blog_link();

-- Answers: { "<question id>": "<option id>" }. No policies => service role only.
create table academy_quiz_keys (
  resource_id uuid primary key references academy_resources(id) on delete cascade,
  answer_key jsonb not null default '{}'
);

-- One row per person per resource, written when they pass (or by the import, flagged). Never by the client.
create table academy_completions (
  user_id uuid not null references profiles(id) on delete cascade,
  resource_id uuid not null references academy_resources(id) on delete restrict,
  completed_at timestamptz not null default now(),
  is_imported boolean not null default false,
  primary key (user_id, resource_id)
);

create index academy_completions_resource on academy_completions (resource_id);

-- Every quiz try (pass or fail): how many were right out of 5.
create table academy_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  resource_id uuid not null references academy_resources(id) on delete cascade,
  correct smallint not null check (correct between 0 and 5),
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index academy_quiz_attempts_user on academy_quiz_attempts (user_id, resource_id, created_at desc);

alter table academy_resources     enable row level security;
alter table academy_quiz_keys     enable row level security;   -- no policies
alter table academy_completions   enable row level security;
alter table academy_quiz_attempts enable row level security;

-- Everyone signed in sees what's published; editors and admins also see drafts and archived ones.
create policy academy_resources_select on academy_resources for select to authenticated
  using (status = 'published' or public.is_admin() or public.is_academy_editor());

create policy academy_completions_select on academy_completions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy academy_quiz_attempts_select on academy_quiz_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on academy_resources, academy_quiz_keys, academy_completions, academy_quiz_attempts from anon, authenticated;
grant select on academy_resources, academy_completions, academy_quiz_attempts to authenticated;
grant all on academy_resources, academy_quiz_keys, academy_completions, academy_quiz_attempts to service_role;

-- Team view (leads and admins) ---------------------------------------------------------------
-- Who completed which published resource, and when. Nothing else (no attempts, no scores).
create or replace function public.team_academy()
returns table (user_id uuid, resource_id uuid, completed_at timestamptz, is_imported boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_lead()) then
    raise exception 'only leads and admins can see team progress' using errcode = '42501';
  end if;
  return query
    select c.user_id, c.resource_id, c.completed_at, c.is_imported
    from academy_completions c
    join academy_resources r on r.id = c.resource_id
    where r.status = 'published';
end;
$$;

revoke execute on function public.team_academy() from public, anon;
grant execute on function public.team_academy() to authenticated, service_role;

-- Storage: thumbnails and covers --------------------------------------------------------------
-- Public (blog thumbnails and book covers are public pictures anyway). Uploads only through server actions with the
-- service role, so there are no client policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy', 'academy', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
