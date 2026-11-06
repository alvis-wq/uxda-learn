-- UXDA Academy: where else a podcast episode can be heard. Each episode can link to its Spotify episode and YouTube
-- video next to its Buzzsprout page (`url`); the card shows the ones it has. Filled by scripts/import-podcasts.ts
-- --links (matched by episode number) or by an editor. Only those two sites' https links are accepted.

alter table academy_resources
  add column spotify_url text check (spotify_url ~ '^https://open\.spotify\.com/episode/[A-Za-z0-9]+$'),
  add column youtube_url text check (youtube_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]+$'),
  add constraint academy_resources_listen_links check ((spotify_url is null and youtube_url is null) or kind = 'podcast');
