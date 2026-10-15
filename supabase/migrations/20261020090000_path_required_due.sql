-- Paths: required_for and due_at, admin-owned like a challenge's (and like a path's status). A content file sets them
-- only when content:sync creates the path; after that they change in Admin -> Content through set_path_setting(),
-- which writes the audit row in the same transaction. A required path counts as ONE required item (done when every
-- milestone has a published score); its milestones are never required on their own. Computed by the app.
alter table paths add column required_for audience[] not null default '{}';
alter table paths add constraint paths_required_for_valid
  check (cardinality(required_for) = 0 or public.valid_audiences(required_for));
alter table paths add column due_at timestamptz;

alter table path_settings_audit drop constraint path_settings_audit_field_check;
alter table path_settings_audit add constraint path_settings_audit_field_check
  check (field in ('status', 'required_for', 'due_at'));

-- Set a path's required_for or due_at and record old -> new (no row for a no-op). Status keeps set_path_status (it
-- can also publish the milestones). Validation (only tracks that can see the path) happens in the server action; the
-- column checks still guard the shape. Returns true when the value changed.
create or replace function public.set_path_setting(
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
  if p_source = 'admin' and not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change a path''s settings' using errcode = '42501';
  end if;
  if p_field = 'required_for' then
    select to_jsonb(required_for) into v_old from paths where slug = p_slug for update;
  elsif p_field = 'due_at' then
    select to_jsonb(due_at) into v_old from paths where slug = p_slug for update;
  else
    raise exception 'unknown path setting: %', p_field using errcode = '22023';
  end if;
  if not found then
    raise exception 'path not found: %', p_slug using errcode = 'P0002';
  end if;

  if p_field = 'required_for' then
    update paths
      set required_for = coalesce(
            (select array_agg(x::audience order by i)
               from jsonb_array_elements_text(p_value) with ordinality as e(x, i)), '{}'),
          updated_at = now()
      where slug = p_slug returning to_jsonb(required_for) into v_new;
  else
    update paths set due_at = (p_value #>> '{}')::timestamptz, updated_at = now()
      where slug = p_slug returning to_jsonb(due_at) into v_new;
  end if;

  if v_old is not distinct from v_new then
    return false;
  end if;
  insert into path_settings_audit (path_slug, field, old_value, new_value, source, changed_by)
    values (p_slug, p_field, v_old, v_new, p_source, p_actor);
  return true;
end;
$$;

revoke execute on function public.set_path_setting(text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.set_path_setting(text, text, jsonb, text, uuid) to service_role;
