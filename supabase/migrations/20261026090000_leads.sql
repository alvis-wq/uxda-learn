-- Leads: people who can see the team's progress (who has finished which challenge, by category) without admin powers.
--
--  * profiles.is_lead, changeable only by the service role (the Users page action checks is_admin() first) and
--    audited in profile_flag_audit by set_user_lead(). Admins can always see team progress, flag or not.
--  * No RLS is widened: profiles_select and submissions_select stay own-rows-or-admin, so a lead can't read anyone's
--    answers, feedback, screenshots or email. Team progress comes from three security definer functions that refuse
--    anyone who isn't a lead or an admin and return only the columns the Team page shows.

-- Lead flag -------------------------------------------------------------------
alter table profiles add column is_lead boolean not null default false;
-- `authenticated` can only update show_on_leaderboard (see init), so is_lead is service-role only.

create or replace function public.is_lead() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_lead from profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_lead() from public, anon;
grant execute on function public.is_lead() to authenticated, service_role;

-- Audit of flag changes: is_lead joins is_tester ------------------------------------
alter table profile_flag_audit drop constraint profile_flag_audit_field_check;
alter table profile_flag_audit add constraint profile_flag_audit_field_check check (field in ('is_tester', 'is_lead'));

-- Set the lead flag and record old -> new in one transaction. The actor must be an admin. Returns true when the
-- value changed (no audit row, and false, when it already had that value). Service role only.
create or replace function public.set_user_lead(p_user uuid, p_value boolean, p_actor uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old boolean;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change the lead flag' using errcode = '42501';
  end if;
  select is_lead into v_old from profiles where id = p_user for update;
  if not found then
    raise exception 'user not found: %', p_user using errcode = 'P0002';
  end if;
  if v_old = p_value then
    return false;
  end if;
  update profiles set is_lead = p_value where id = p_user;
  insert into profile_flag_audit (profile_id, field, old_value, new_value, changed_by)
    values (p_user, 'is_lead', v_old, p_value, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_user_lead(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_user_lead(uuid, boolean, uuid) to service_role;

-- Team progress (leads and admins) ----------------------------------------------------
-- Each refuses a caller who is neither (42501). show_on_leaderboard is ignored on purpose: it hides people from their
-- peers on the leaderboard, not from the people who look after the team.

-- Everyone who has finished onboarding. No email.
create or replace function public.team_members()
returns table (id uuid, full_name text, avatar_url text, track track)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_lead()) then
    raise exception 'only leads and admins can see team progress' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.avatar_url, p.track
    from profiles p
    where p.track is not null
    order by p.full_name nulls last, p.id;
end;
$$;

-- Real attempts only (never test attempts), with only what a status + score needs: no answers, feedback or images.
create or replace function public.team_submissions()
returns table (
  user_id uuid, challenge_slug text, attempt int, status submission_status,
  final_score numeric, max_score numeric, published_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_lead()) then
    raise exception 'only leads and admins can see team progress' using errcode = '42501';
  end if;
  return query
    select s.user_id, s.challenge_slug, s.attempt, s.status, s.final_score, s.max_score, s.published_at
    from submissions s
    where not s.is_test;
end;
$$;

-- Read & confirm items: who confirmed which, and when.
create or replace function public.team_acknowledgements()
returns table (user_id uuid, challenge_slug text, acknowledged_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_lead()) then
    raise exception 'only leads and admins can see team progress' using errcode = '42501';
  end if;
  return query
    select a.user_id, a.challenge_slug, a.acknowledged_at
    from acknowledgements a;
end;
$$;

revoke execute on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated, service_role;
revoke execute on function public.team_submissions() from public, anon;
grant execute on function public.team_submissions() to authenticated, service_role;
revoke execute on function public.team_acknowledgements() from public, anon;
grant execute on function public.team_acknowledgements() to authenticated, service_role;
