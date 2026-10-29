-- Review edits: learners can change a submission until it's reviewed, and admins can change a score after it.
--
--  * submissions.edited_at: when the learner last changed the submission (null: never). Written only by
--    edit_submission(). The admin review and eval:push compare it, so neither can act on content that changed under
--    them.
--  * edit_submission(): the learner's change, in one transaction: new content, back to `submitted`, the unapproved AI
--    evaluation(s) of the old content removed (the next /evaluate scores the new version). Only while the submission
--    is `submitted` or `ai_reviewed`, never a test or imported attempt. An empty Figma link or reflection is stored as
--    null (generated RPC types don't allow null arguments). Service role only (the server action checks
--    the session user, the challenge and the input first).
--  * adjust_submission_review(): an admin changes the score and/or feedback of a reviewed submission (published or
--    needs resubmission), audited in submission_review_audit. Service role only; the actor must be an admin.

alter table submissions add column edited_at timestamptz;

-- Learner edit ------------------------------------------------------------------------------------------------------
create or replace function public.edit_submission(
  p_submission uuid,
  p_user uuid,
  p_answers jsonb,
  p_image_paths text[],
  p_figma_url text,
  p_reflection text,
  p_auto_score numeric,
  p_challenge_version int,
  p_max_score numeric
)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  update submissions
     set answers = p_answers,
         image_paths = p_image_paths,
         figma_url = nullif(p_figma_url, ''),
         reflection = nullif(p_reflection, ''),
         auto_score = p_auto_score,
         challenge_version = p_challenge_version,
         max_score = p_max_score,
         status = 'submitted',
         final_score = null,
         feedback = null,
         edited_at = v_now
   where id = p_submission
     and user_id = p_user
     and status in ('submitted', 'ai_reviewed')
     and not is_test
     and not is_imported;
  if not found then
    raise exception 'submission can no longer be edited: %', p_submission using errcode = '42501';
  end if;
  -- The AI scored the old content: drop what nobody approved (an approved one can't exist while still reviewable).
  delete from evaluations where submission_id = p_submission and approved_at is null;
  return v_now;
end;
$$;

revoke execute on function public.edit_submission(uuid, uuid, jsonb, text[], text, text, numeric, int, numeric)
  from public, anon, authenticated;
grant execute on function public.edit_submission(uuid, uuid, jsonb, text[], text, text, numeric, int, numeric)
  to service_role;

-- Score changes after review ----------------------------------------------------------------------------------------
create table submission_review_audit (
  id bigint generated always as identity primary key,
  submission_id uuid not null references submissions(id) on delete cascade,
  old_score numeric,
  new_score numeric not null,
  old_feedback text,
  new_feedback text,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index submission_review_audit_submission_idx on submission_review_audit (submission_id, changed_at desc);

alter table submission_review_audit enable row level security;
create policy submission_review_audit_select on submission_review_audit for select to authenticated
  using (public.is_admin());

-- Empty feedback is stored as null. Returns true when something changed (no audit row, and false, when score and feedback are already these).
create or replace function public.adjust_submission_review(
  p_submission uuid,
  p_score numeric,
  p_feedback text,
  p_actor uuid
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_sub submissions%rowtype;
  v_feedback text := nullif(btrim(p_feedback), '');
begin
  if not coalesce((select is_admin from profiles where id = p_actor), false) then
    raise exception 'only an admin can change a score' using errcode = '42501';
  end if;
  select * into v_sub from submissions where id = p_submission for update;
  if not found then
    raise exception 'submission not found: %', p_submission using errcode = 'P0002';
  end if;
  if v_sub.status not in ('published', 'needs_resubmission') or v_sub.is_test then
    raise exception 'only a reviewed submission can be changed' using errcode = '42501';
  end if;
  if p_score < 0 or p_score > v_sub.max_score then
    raise exception 'score out of range' using errcode = '22003';
  end if;
  if v_sub.status = 'needs_resubmission' and v_feedback is null then
    raise exception 'a resubmission request needs feedback' using errcode = '23514';
  end if;
  if v_sub.final_score is not distinct from p_score and v_sub.feedback is not distinct from v_feedback then
    return false;
  end if;
  update submissions set final_score = p_score, feedback = v_feedback where id = p_submission;
  insert into submission_review_audit (submission_id, old_score, new_score, old_feedback, new_feedback, changed_by)
    values (p_submission, v_sub.final_score, p_score, v_sub.feedback, v_feedback, p_actor);
  return true;
end;
$$;

revoke execute on function public.adjust_submission_review(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.adjust_submission_review(uuid, numeric, text, uuid) to service_role;
