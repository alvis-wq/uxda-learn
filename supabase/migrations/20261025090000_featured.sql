-- Featured challenges and paths: the home page's "Featured" section, above the challenge list.
--
-- Admin-owned like status / required_for / due_at: set only in Admin -> Content (content files never have them, so
-- content:sync never writes them), saved through set_challenge_setting / set_path_setting with an audit row.
-- featured_for: the tracks it's featured for ('{}' = not featured, or {all}); learners also need to be able to see it
-- (checked by the app, like required_for). featured_at: when it was featured; the home order (oldest first), changed
-- only by move_featured. A path milestone can't be featured on its own (its path can be): set_challenge_setting
-- refuses it. Not a table constraint, so content:sync moving an already featured challenge into a path still works
-- (the home page never lists milestones, so it simply stops showing).

alter table challenges
  add column featured_for audience[] not null default '{}'
    check (cardinality(featured_for) = 0 or public.valid_audiences(featured_for)),
  add column featured_at timestamptz,
  add constraint challenges_featured_at check ((cardinality(featured_for) = 0) = (featured_at is null));

alter table paths
  add column featured_for audience[] not null default '{}'
    check (cardinality(featured_for) = 0 or public.valid_audiences(featured_for)),
  add column featured_at timestamptz,
  add constraint paths_featured_at check ((cardinality(featured_for) = 0) = (featured_at is null));

alter table challenge_settings_audit drop constraint challenge_settings_audit_field_check;
alter table challenge_settings_audit add constraint challenge_settings_audit_field_check
  check (field in ('status', 'required_for', 'due_at', 'featured_for', 'featured_order'));
alter table path_settings_audit drop constraint path_settings_audit_field_check;
alter table path_settings_audit add constraint path_settings_audit_field_check
  check (field in ('status', 'required_for', 'due_at', 'featured_for', 'featured_order'));

-- set_challenge_setting: as before (20261011090000_challenge_settings_audit.sql), plus featured_for. Featuring stamps
-- featured_at (the item goes last), un-featuring clears it, changing only the tracks keeps it (and the place).
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
  elsif p_field = 'featured_for' then
    select to_jsonb(featured_for) into v_old from challenges where slug = p_slug for update;
  else
    raise exception 'unknown challenge setting: %', p_field using errcode = '22023';
  end if;
  if not found then
    raise exception 'challenge not found: %', p_slug using errcode = 'P0002';
  end if;
  if p_field = 'featured_for' and jsonb_array_length(p_value) > 0
     and (select path_slug from challenges where slug = p_slug) is not null then
    raise exception 'a path milestone can''t be featured on its own: %', p_slug using errcode = '22023';
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
  elsif p_field = 'featured_for' then
    update challenges c
      set featured_for = f.value,
          featured_at = case when cardinality(f.value) = 0 then null else coalesce(c.featured_at, now()) end,
          updated_at = now()
      from (select coalesce(
              (select array_agg(x::audience order by i)
                 from jsonb_array_elements_text(p_value) with ordinality as e(x, i)), '{}') as value) f
      where c.slug = p_slug returning to_jsonb(c.featured_for) into v_new;
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

-- set_path_setting: as before (20261020090000_path_required_due.sql), plus featured_for (same rules as a challenge's).
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
  elsif p_field = 'featured_for' then
    select to_jsonb(featured_for) into v_old from paths where slug = p_slug for update;
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
  elsif p_field = 'featured_for' then
    update paths p
      set featured_for = f.value,
          featured_at = case when cardinality(f.value) = 0 then null else coalesce(p.featured_at, now()) end,
          updated_at = now()
      from (select coalesce(
              (select array_agg(x::audience order by i)
                 from jsonb_array_elements_text(p_value) with ordinality as e(x, i)), '{}') as value) f
      where p.slug = p_slug returning to_jsonb(p.featured_for) into v_new;
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

-- Move a featured challenge or path one place up or down in the home order (challenges and paths share one list,
-- ordered by featured_at, then kind and slug). Swaps featured_at with the neighbour and records both moves as
-- 'featured_order' (1-based positions) in each one's audit log. Admin only. Returns false at either end.
create or replace function public.move_featured(
  p_kind text,
  p_slug text,
  p_direction text,
  p_actor uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_keys text[];
  v_times timestamptz[];
  v_pos int;
  v_to int;
  v_other_kind text;
  v_other_slug text;
  v_at timestamptz;
  v_other_at timestamptz;
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can reorder featured items' using errcode = '42501';
  end if;
  if p_kind not in ('challenge', 'path') or p_direction not in ('up', 'down') then
    raise exception 'invalid move: % % %', p_kind, p_slug, p_direction using errcode = '22023';
  end if;

  -- One reorder at a time: lock every featured row before reading the order.
  perform 1 from challenges where featured_at is not null for update;
  perform 1 from paths where featured_at is not null for update;

  select array_agg(k order by at, k), array_agg(at order by at, k) into v_keys, v_times
    from (
      select 'challenge:' || slug as k, featured_at as at from challenges where featured_at is not null
      union all
      select 'path:' || slug, featured_at from paths where featured_at is not null
    ) items;

  v_pos := array_position(v_keys, p_kind || ':' || p_slug);
  if v_pos is null then
    raise exception 'not featured: % %', p_kind, p_slug using errcode = 'P0002';
  end if;
  v_to := v_pos + case when p_direction = 'up' then -1 else 1 end;
  if v_to < 1 or v_to > cardinality(v_keys) then
    return false;
  end if;

  v_other_kind := split_part(v_keys[v_to], ':', 1);
  v_other_slug := substr(v_keys[v_to], length(v_other_kind) + 2);
  v_at := v_times[v_pos];
  v_other_at := v_times[v_to];
  -- Equal times (featured in one transaction): nudge by a microsecond so the order really changes.
  if v_at = v_other_at then
    v_other_at := v_other_at + case when p_direction = 'up' then -interval '1 microsecond' else interval '1 microsecond' end;
  end if;

  if p_kind = 'challenge' then
    update challenges set featured_at = v_other_at where slug = p_slug;
    insert into challenge_settings_audit (challenge_slug, field, old_value, new_value, source, changed_by)
      values (p_slug, 'featured_order', to_jsonb(v_pos), to_jsonb(v_to), 'admin', p_actor);
  else
    update paths set featured_at = v_other_at where slug = p_slug;
    insert into path_settings_audit (path_slug, field, old_value, new_value, source, changed_by)
      values (p_slug, 'featured_order', to_jsonb(v_pos), to_jsonb(v_to), 'admin', p_actor);
  end if;

  if v_other_kind = 'challenge' then
    update challenges set featured_at = v_at where slug = v_other_slug;
    insert into challenge_settings_audit (challenge_slug, field, old_value, new_value, source, changed_by)
      values (v_other_slug, 'featured_order', to_jsonb(v_to), to_jsonb(v_pos), 'admin', p_actor);
  else
    update paths set featured_at = v_at where slug = v_other_slug;
    insert into path_settings_audit (path_slug, field, old_value, new_value, source, changed_by)
      values (v_other_slug, 'featured_order', to_jsonb(v_to), to_jsonb(v_pos), 'admin', p_actor);
  end if;
  return true;
end;
$$;

revoke execute on function public.move_featured(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.move_featured(text, text, text, uuid) to service_role;
