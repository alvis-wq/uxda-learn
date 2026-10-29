-- New points (2026-10-29): optional challenges 3, required quizzes 6, each step of a required path (and each required
-- strategist wireframing challenge) 10. The content files carry the new points; this converts the scores people already
-- have, so old and new attempts count the same on the leaderboard.
--
--  * Every attempt on a changed challenge whose max_score is still the old points gets the new max_score, and its
--    final_score and auto_score scaled to it, rounded to half points (8/10 on a quiz now worth 6 becomes 5/6). The
--    max_score match makes it safe to run after content:sync and touches nothing scored under the new points.
--  * Each scored attempt gets a submission_review_audit row (changed_by null, the new `note` says why), listed under
--    "Changes after review" on the admin submission page. evaluations keep the AI's per-criterion scores as they were.

alter table submission_review_audit add column note text;

create temp table points_change (slug text primary key, old_max numeric not null, new_max numeric not null) on commit drop;
insert into points_change (slug, old_max, new_max) values
  ('alh-1-edit-auto-layout-card', 20, 10),
  ('alh-2-convert-manual-layout', 20, 10),
  ('alh-3-list-from-loose-elements', 20, 10),
  ('alh-4-chips-that-wrap', 20, 10),
  ('alh-5-remove-auto-layout-safely', 20, 10),
  ('alh-6-equal-size-grid', 20, 10),
  ('alh-7-final-boss', 40, 10),
  ('btt-3-brand-colours', 20, 10),
  ('bwt-3-light-and-dark', 20, 10),
  ('wfc-1-know-the-system', 12, 10),
  ('wfc-2-work-with-the-skills', 8, 10),
  ('wfc-3-judgment-calls', 16, 10),
  ('wf-3-check-and-fix', 10, 3),
  ('wf-4-claude-design-to-figma', 20, 10),
  ('wf-5-add-library-component', 20, 10),
  ('wf-6-handoff-ready', 20, 10),
  ('claude-at-uxda', 10, 6),
  ('second-opinion', 10, 6),
  ('uxda-dna-7-values', 10, 6),
  ('when-claude-says-no', 10, 6),
  ('uxda-collaboration-standards', 10, 6),
  ('verify-before-you-trust', 10, 6),
  ('right-model-for-the-job', 10, 3),
  ('uxda-superheroes', 10, 3);

-- Audit first, while the old scores are still there.
insert into submission_review_audit (submission_id, old_score, new_score, old_feedback, new_feedback, changed_by, note)
select s.id, s.final_score, round(s.final_score * c.new_max / c.old_max * 2) / 2, s.feedback, s.feedback, null,
       'Points changed: ' || c.old_max || ' → ' || c.new_max
  from submissions s
  join points_change c on c.slug = s.challenge_slug
 where s.max_score = c.old_max
   and s.final_score is not null;

update submissions s
   set final_score = round(s.final_score * c.new_max / c.old_max * 2) / 2,
       auto_score = round(s.auto_score * c.new_max / c.old_max * 2) / 2,
       max_score = c.new_max
  from points_change c
 where c.slug = s.challenge_slug
   and s.max_score = c.old_max;
