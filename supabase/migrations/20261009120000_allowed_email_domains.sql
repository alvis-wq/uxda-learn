-- Allowed sign-in email domains live in a table instead of being hardcoded in handle_new_user.
-- Rows are synced from ALLOWED_EMAIL_DOMAINS by `npm run seed:domains`. Until it runs the
-- table is empty and every sign-up is rejected (fail closed).

create table allowed_email_domains (
  domain text primary key
    check (domain = lower(domain) and domain ~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$')
);

alter table allowed_email_domains enable row level security;   -- no policies
-- No grants for anon/authenticated => service role only (like admin_allowlist).
revoke all on allowed_email_domains from anon, authenticated;
grant all on allowed_email_domains to service_role;

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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
