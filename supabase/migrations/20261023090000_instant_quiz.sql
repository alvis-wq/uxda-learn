-- Instant-feedback quizzes and per-question explanations.
--
-- `feedback_mode` (content, part of content_hash): 'final' shows results after submit; 'instant' checks each answer
-- on the server as the learner goes and allows ONE real attempt (testers' test attempts stay unlimited).
alter table challenges
  add column feedback_mode text not null default 'final' check (feedback_mode in ('final', 'instant'));

-- Why the right answer is right, per question id. Private like the answer key: shown in instant mode only once the
-- learner answered correctly, and on the result page under the normal reveal rules.
alter table challenge_keys
  add column explanations jsonb not null default '{}'
    check (jsonb_typeof(explanations) = 'object' and octet_length(explanations::text) <= 200000);

-- Instant mode: how many times each question was checked in the run in progress, and whether it's solved:
-- {"test": bool, "questions": {"<id>": {"tries": n, "solved": bool}}}. Written ONLY by record_instant_try (service
-- role); the learner's own session can neither write this column nor delete a draft that has it, so a refresh, a
-- direct API call or "Start over" can never reset the count.
alter table submission_drafts
  add column instant_tries jsonb
    check (instant_tries is null or (jsonb_typeof(instant_tries) = 'object' and octet_length(instant_tries::text) <= 50000));

revoke insert, update on submission_drafts from authenticated;
grant insert (user_id, challenge_slug, challenge_version, answers, figma_url, reflection, image_paths, current_step, updated_at)
  on submission_drafts to authenticated;
grant update (user_id, challenge_slug, challenge_version, answers, figma_url, reflection, image_paths, current_step, updated_at)
  on submission_drafts to authenticated;

drop policy submission_drafts_delete on submission_drafts;
create policy submission_drafts_delete on submission_drafts for delete to authenticated
  using (user_id = auth.uid() and instant_tries is null);

-- The tries behind an instant-mode attempt's score, per question id ({"q1": 1, "q2": 3}); null in final mode.
alter table submissions
  add column question_tries jsonb
    check (question_tries is null or (jsonb_typeof(question_tries) = 'object' and octet_length(question_tries::text) <= 50000));

-- Count one check of one question in a learner's instant run, atomically (two clicks at once are two tries).
-- A solved question stays solved and is never counted again. A run of the other kind (a test run left behind when
-- the challenge was published, or the reverse) is discarded first. Returns the run's state after the check.
create or replace function public.record_instant_try(
  p_user uuid,
  p_challenge text,
  p_version int,
  p_question text,
  p_correct boolean,
  p_is_test boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb;
begin
  insert into submission_drafts (user_id, challenge_slug, challenge_version)
  values (p_user, p_challenge, p_version)
  on conflict (user_id, challenge_slug) do nothing;

  update submission_drafts d
     set instant_tries = case
           when d.instant_tries is null or (d.instant_tries ->> 'test')::boolean is distinct from p_is_test
             then jsonb_build_object('test', p_is_test, 'questions', '{}'::jsonb)
           else d.instant_tries
         end
   where d.user_id = p_user and d.challenge_slug = p_challenge;

  update submission_drafts d
     set instant_tries = jsonb_set(
           d.instant_tries,
           array['questions', p_question],
           case
             when coalesce((d.instant_tries #>> array['questions', p_question, 'solved'])::boolean, false)
               then d.instant_tries #> array['questions', p_question]
             else jsonb_build_object(
               'tries', coalesce((d.instant_tries #>> array['questions', p_question, 'tries'])::int, 0) + 1,
               'solved', p_correct)
           end),
         challenge_version = p_version,
         updated_at = now()
   where d.user_id = p_user and d.challenge_slug = p_challenge
  returning d.instant_tries into v_state;

  return v_state;
end;
$$;

revoke execute on function public.record_instant_try(uuid, text, int, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.record_instant_try(uuid, text, int, text, boolean, boolean) to service_role;
