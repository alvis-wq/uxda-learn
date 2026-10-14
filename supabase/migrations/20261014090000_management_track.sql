-- New track "management" (CEO and COO). Enum values must be committed before they can be used,
-- so this is its own migration. Challenges with audiences: [all] include it automatically;
-- get_leaderboard filters by the tracks the app passes in, so no function changes are needed.

alter type track add value if not exists 'management';
alter type audience add value if not exists 'management';
