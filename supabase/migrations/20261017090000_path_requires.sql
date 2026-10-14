-- Paths: an optional order between paths (content/paths/<slug>.yaml `requires:`). A path stays locked until every
-- milestone of each required path has an attempt (checked by the app, like milestone unlocking). Written by
-- content:sync like the other content columns.
alter table paths add column requires text[] not null default '{}';
