-- Challenges: optional waiting time (minutes spent waiting while Claude Code works), part of estimated_minutes.
-- Hands-on time = estimated_minutes - waiting_minutes; calculated by the app, never stored. Written by content:sync
-- like estimated_minutes.
alter table challenges add column waiting_minutes int
  check (waiting_minutes is null or (waiting_minutes >= 0 and estimated_minutes is not null and waiting_minutes <= estimated_minutes));
