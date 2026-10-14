-- Paths: an optional "Before you start" box at the top of the path page (markdown from content/paths/<slug>.yaml,
-- written by content:sync like the other content columns).
alter table paths add column before_you_start text
  check (before_you_start is null or char_length(before_you_start) <= 600);
