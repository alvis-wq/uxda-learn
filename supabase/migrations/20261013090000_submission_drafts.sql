-- Server-side drafts: a learner's in-progress answers to a challenge, so they can carry on after signing out,
-- closing the browser or switching device. One row per (user, challenge); deleted on a successful submit.
--
-- Unlike the other learner tables this one is written by the signed-in user's own session (not the service role):
-- a draft holds nothing that is scored or trusted (no status, no points), the server action still validates what it
-- saves, and the policies below are the hard stop. Admins get no special access: `is_admin()` appears nowhere.
-- Screenshots are referenced by Storage path (the files are already in the user's own folder).

create table submission_drafts (
  user_id uuid not null references profiles(id) on delete cascade,
  challenge_slug text not null references challenges(slug),
  -- The content version the answers were written against: if the challenge changed since, restore keeps only
  -- the answers whose question ids still exist.
  challenge_version int not null,
  answers jsonb not null default '{}',
  figma_url text,
  reflection text,
  image_paths text[] not null default '{}',
  -- 1-based Stepper step.
  current_step int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_slug),
  -- Shape limits, so a direct write can't stash arbitrary amounts of data.
  check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 200000),
  check (current_step between 1 and 100),
  check (figma_url is null or char_length(figma_url) <= 2000),
  check (reflection is null or char_length(reflection) <= 20000),
  check (cardinality(image_paths) <= 10)
);

alter table submission_drafts enable row level security;

create policy submission_drafts_select on submission_drafts for select to authenticated
  using (user_id = auth.uid());
create policy submission_drafts_insert on submission_drafts for insert to authenticated
  with check (user_id = auth.uid());
create policy submission_drafts_update on submission_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy submission_drafts_delete on submission_drafts for delete to authenticated
  using (user_id = auth.uid());

revoke all on submission_drafts from anon, authenticated;
grant select, insert, update, delete on submission_drafts to authenticated;
grant all on submission_drafts to service_role;

-- Optional short hint shown above a challenge's questions, from the `tip` field of its frontmatter (markdown).
-- Display only: not part of content_hash, so changing it never bumps a challenge's version.
alter table challenges add column tip text
  check (tip is null or char_length(tip) <= 1000);
