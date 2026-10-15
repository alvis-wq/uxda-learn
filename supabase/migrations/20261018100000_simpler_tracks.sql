-- Simpler tracks: account manager and assistant are no longer offered; everyone on them moves to management.
-- Data only: the enum values stay, so old audit rows, content and history keep working. Each move is audited.

insert into staff_audit (email, field, old_value, new_value, source, note)
select email, 'track', track::text, 'management', 'migration',
       '20261018100000_simpler_tracks: account manager and assistant merged into management'
from profiles
where track in ('account_manager', 'assistant');

update profiles set track = 'management' where track in ('account_manager', 'assistant');
