-- Optional link to a challenge's source material, from `help_link: { url, label }` in its content file. Instant mode
-- offers it in the wrong-answer dialog ("Not sure? Refresh your memory in <label>."). Display only, like `tip`: not
-- part of content_hash, so changing it never bumps a challenge's version. Keep the limits in step with
-- src/lib/content/schema.ts.
alter table challenges
  add column help_link jsonb
    check (
      help_link is null or (
        jsonb_typeof(help_link) = 'object'
        and help_link - 'url' - 'label' = '{}'::jsonb
        and jsonb_typeof(help_link -> 'url') = 'string'
        and jsonb_typeof(help_link -> 'label') = 'string'
        and help_link ->> 'url' ~ '^https://[^[:space:]]+$'
        and char_length(help_link ->> 'url') <= 2000
        and char_length(help_link ->> 'label') between 1 and 120
      )
    );
