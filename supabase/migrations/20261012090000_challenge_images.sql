-- Optional card artwork. `image` is a file name in public/challenges/ (e.g. "red-flags.webp"), set from the
-- `image` field of a challenge's frontmatter / a category in categories.yaml. A challenge without its own image
-- falls back to its category's; neither = no image. Display only: it is not part of content_hash, so changing
-- it never bumps a challenge's version.

alter table categories add column image text
  check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$');

alter table challenges add column image text
  check (image is null or image ~ '^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$');
