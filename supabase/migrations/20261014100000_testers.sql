-- Testers: people an admin trusts to try draft challenges before they go live.
--
--  * profiles.is_tester, changeable only by the service role (the Users page action checks is_admin() first) and
--    audited in profile_flag_audit by set_user_tester().
--  * challenges_select: a tester also sees DRAFT challenges that their track can see (the challenge's audiences and
--    its category's, category not archived). Archived stays hidden. This is the hard stop; the UI only follows it.
--  * submissions.is_test: attempts on a draft are test attempts. They are numbered on their own (so the 3-attempt
--    limit never touches them), the app leaves them out of every score / count, the leaderboard function ignores
--    them, and the owner can read them only while the challenge is still a draft (after publishing, the tester
--    starts fresh; admins still see them).
--  * challenge_feedback: notes from testers on a draft, readable by admins only, written by a server action.

-- Tester flag ----------------------------------------------------------------
alter table profiles add column is_tester boolean not null default false;
-- `authenticated` can only update show_on_leaderboard (see init), so is_tester is service-role only.

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

revoke execute on function public.is_tester() from public, anon;
grant execute on function public.is_tester() to authenticated, service_role;
revoke execute on function public.my_track_sees(audience[]) from public, anon;
grant execute on function public.my_track_sees(audience[]) to authenticated, service_role;

-- Audit of flag changes ----------------------------------------------------------
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

alter table profile_flag_audit enable row level security;
create policy profile_flag_audit_select on profile_flag_audit for select to authenticated
  using (public.is_admin());
-- No write policies or grants: written only by set_user_tester() via the service role.
revoke all on profile_flag_audit from anon, authenticated;
grant select on profile_flag_audit to authenticated;
grant all on profile_flag_audit to service_role;

-- Set the tester flag and record old -> new in one transaction. The actor must be an admin. Returns true when the
-- value changed (no audit row, and false, when it already had that value). Service role only.
create or replace function public.set_user_tester(p_user uuid, p_value boolean, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old boolean;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change the tester flag' using errcode = '42501';
  end if;
  select is_tester into v_old from profiles where id = p_user for update;
  if not found then
    raise exception 'user not found: %', p_user using errcode = 'P0002';
  end if;
  if v_old = p_value then
    return false;
  end if;
  update profiles set is_tester = p_value where id = p_user;
  insert into profile_flag_audit (profile_id, field, old_value, new_value, changed_by)
    values (p_user, 'is_tester', v_old, p_value, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_user_tester(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_user_tester(uuid, boolean, uuid) to service_role;

-- Testers see drafts their track can see ---------------------------------------------
drop policy challenges_select on challenges;
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

-- Test attempts ----------------------------------------------------------------------
alter table submissions add column is_test boolean not null default false;

-- Real attempts stay capped at 3 (also in the database); test attempts are numbered 1, 2, 3, ... on their own.
alter table submissions drop constraint if exists submissions_attempt_check;
alter table submissions drop constraint if exists submissions_user_id_challenge_slug_attempt_key;
alter table submissions add constraint submissions_attempt_range check (attempt >= 1 and (is_test or attempt <= 3));
alter table submissions add constraint submissions_user_challenge_test_attempt_key
  unique (user_id, challenge_slug, is_test, attempt);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.submissions'::regclass
      and conname in ('submissions_attempt_check', 'submissions_user_id_challenge_slug_attempt_key')
  ) then
    raise exception 'old attempt constraints are still on submissions';
  end if;
end $$;

-- Owners read their own attempts; a TEST attempt only while the challenge is still a draft (after publishing the
-- tester starts fresh). Admins read everything. Writes: server actions with the service role only.
drop policy submissions_select on submissions;
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

-- Test attempts never count towards the leaderboard.
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

-- Tester feedback ----------------------------------------------------------------------
create table challenge_feedback (
  id uuid primary key default gen_random_uuid(),
  challenge_slug text not null references challenges(slug) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index challenge_feedback_slug_idx on challenge_feedback (challenge_slug, created_at desc);

alter table challenge_feedback enable row level security;
create policy challenge_feedback_select on challenge_feedback for select to authenticated
  using (public.is_admin());
-- No write policies or grants: written by a server action (service role) that checks the sender is a tester and the
-- challenge is a draft they can see.
revoke all on challenge_feedback from anon, authenticated;
grant select on challenge_feedback to authenticated;
grant all on challenge_feedback to service_role;
