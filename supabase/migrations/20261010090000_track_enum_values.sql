-- New tracks and the acknowledge challenge type.
-- Enum values must be committed before they can be used, so this runs as its own migration
-- (db:push wraps each migration in one transaction); the next migration uses them.

alter type track add value if not exists 'account_manager';
alter type track add value if not exists 'assistant';
alter type track add value if not exists 'motion_designer';

alter type audience add value if not exists 'account_manager';
alter type audience add value if not exists 'assistant';
alter type audience add value if not exists 'motion_designer';

alter type challenge_type add value if not exists 'acknowledge';
