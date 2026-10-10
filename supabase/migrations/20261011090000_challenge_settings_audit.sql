-- Admin-owned challenge settings (status, required_for, due_at) + an audit log of changes.
-- content:sync sets these only when it first creates a challenge; afterwards the admin panel
-- owns them. Every change after creation goes through set_challenge_setting(), which writes
-- the new value and its audit row in one transaction.

create table challenge_settings_audit (
  id bigint generated always as identity primary key,
  challenge_slug text not null references challenges(slug) on delete cascade,
  field text not null check (field in ('status', 'required_for', 'due_at')),
  old_value jsonb,
  new_value jsonb,
  -- Who: an admin (changed_by), or content:sync archiving a challenge whose file was removed.
  source text not null check (source in ('admin', 'content:sync')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  check (source <> 'admin' or changed_by is not null)
);

create index challenge_settings_audit_slug_idx on challenge_settings_audit (challenge_slug, changed_at desc);

alter table challenge_settings_audit enable row level security;
create policy challenge_settings_audit_select on challenge_settings_audit for select to authenticated
  using (public.is_admin());
-- No insert/update/delete policies: written only by set_challenge_setting() via the service role.
revoke all on challenge_settings_audit from anon, authenticated;
grant select on challenge_settings_audit to authenticated;
grant all on challenge_settings_audit to service_role;

-- Set one operational field and record old → new. No-op (and no audit row) when unchanged.
-- Returns true when the value changed. Validation (who may see it, TODO placeholders) happens in
-- the server action; the column checks still guard the shape.
create or replace function public.set_challenge_setting(
  p_slug text,
  p_field text,
  p_value jsonb,
  p_source text,
  p_actor uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if p_field = 'status' then
    select to_jsonb(status) into v_old from challenges where slug = p_slug for update;
  elsif p_field = 'required_for' then
    select to_jsonb(required_for) into v_old from challenges where slug = p_slug for update;
  elsif p_field = 'due_at' then
    select to_jsonb(due_at) into v_old from challenges where slug = p_slug for update;
  else
    raise exception 'unknown challenge setting: %', p_field using errcode = '22023';
  end if;
  if not found then
    raise exception 'challenge not found: %', p_slug using errcode = 'P0002';
  end if;

  if p_field = 'status' then
    update challenges set status = p_value #>> '{}', updated_at = now()
      where slug = p_slug returning to_jsonb(status) into v_new;
  elsif p_field = 'required_for' then
    update challenges
      set required_for = coalesce(
            (select array_agg(x::audience order by i)
               from jsonb_array_elements_text(p_value) with ordinality as e(x, i)), '{}'),
          updated_at = now()
      where slug = p_slug returning to_jsonb(required_for) into v_new;
  else
    update challenges set due_at = (p_value #>> '{}')::timestamptz, updated_at = now()
      where slug = p_slug returning to_jsonb(due_at) into v_new;
  end if;

  if v_old is not distinct from v_new then
    return false;
  end if;
  insert into challenge_settings_audit (challenge_slug, field, old_value, new_value, source, changed_by)
    values (p_slug, p_field, v_old, v_new, p_source, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_challenge_setting(text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.set_challenge_setting(text, text, jsonb, text, uuid) to service_role;
