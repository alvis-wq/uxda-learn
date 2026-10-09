-- Multi-track audiences, required challenges, acknowledgements, group leaderboard.
-- Existing single `audience` values are carried over as one-element `audiences` arrays.

-- A valid audience list is exactly {all}, or one or more distinct tracks (no 'all').
create or replace function public.valid_audiences(a audience[]) returns boolean
language sql immutable set search_path = public as $$
  select a is not null
     and cardinality(a) >= 1
     and (a = array['all']::audience[] or not ('all' = any(a)))
     and cardinality(a) = (select count(distinct x) from unnest(a) as x);
$$;

-- Categories: audience -> audiences ---------------------------------------------------
alter table categories add column audiences audience[];
update categories set audiences = array[audience];
alter table categories alter column audiences set not null;
alter table categories drop column audience;
alter table categories add constraint categories_audiences_valid check (public.valid_audiences(audiences));

-- Challenges: audience -> audiences, required_for --------------------------------------
alter table challenges add column audiences audience[];
update challenges set audiences = array[audience];
alter table challenges alter column audiences set not null;
alter table challenges drop column audience;
alter table challenges add constraint challenges_audiences_valid check (public.valid_audiences(audiences));

-- Empty = optional for everyone; otherwise {all} or a list of tracks.
alter table challenges add column required_for audience[] not null default '{}';
alter table challenges add constraint challenges_required_for_valid
  check (cardinality(required_for) = 0 or public.valid_audiences(required_for));

-- Acknowledge challenges are worth 0 points; everything else stays > 0.
alter table challenges drop constraint challenges_points_check;
alter table challenges add constraint challenges_points_check
  check (points >= 0 and ((type = 'acknowledge') = (points = 0)));

-- Acknowledgements ("I've read and understood") -----------------------------------------
-- Separate from submissions so they never count towards scores, the leaderboard or reviews.
create table acknowledgements (
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  challenge_version int not null,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, challenge_slug)
);

alter table acknowledgements enable row level security;
create policy acknowledgements_select on acknowledgements for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies: written by a server action with the service role.
revoke all on acknowledgements from anon, authenticated;
grant select on acknowledgements to authenticated;
grant all on acknowledgements to service_role;

-- Leaderboard by group of tracks (groups are configured in src/lib/tracks.ts) -------------
drop function public.get_leaderboard(track);

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

revoke execute on function public.get_leaderboard(track[]) from public, anon;
grant execute on function public.get_leaderboard(track[]) to authenticated, service_role;
