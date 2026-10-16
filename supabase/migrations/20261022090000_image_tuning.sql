-- Hand tuning of a card illustration, per challenge or path (`image_scale`, `image_offset_x`, `image_offset_y` in
-- its content file): scale multiplies the illustration's width (anchored bottom-right), offsets move it by a % of its
-- own size (x right, y down). Display only, like `image`: never part of content_hash, never bumps a version.
-- Keep the ranges in step with src/lib/content/schema.ts.
alter table challenges
  add column image_scale numeric not null default 1 check (image_scale between 0.5 and 2),
  add column image_offset_x numeric not null default 0 check (image_offset_x between -50 and 50),
  add column image_offset_y numeric not null default 0 check (image_offset_y between -50 and 50);

alter table paths
  add column image_scale numeric not null default 1 check (image_scale between 0.5 and 2),
  add column image_offset_x numeric not null default 0 check (image_offset_x between -50 and 50),
  add column image_offset_y numeric not null default 0 check (image_offset_y between -50 and 50);
