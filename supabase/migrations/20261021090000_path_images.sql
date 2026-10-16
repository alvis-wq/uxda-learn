-- Paths: optional card artwork, like a challenge's (`image` in content/paths/<slug>.yaml, a file name in
-- public/challenges/). A path without its own image falls back to its category's; neither = no image. Display only,
-- written by content:sync like the other path content columns.
alter table paths add column image text
  check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$');
