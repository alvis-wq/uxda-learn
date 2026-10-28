-- UXDA Academy: podcast episodes can go live without a quiz (for now). A listener simply switches one to done.
-- Blog posts and books still need their full 5-question quiz; a podcast may get one later (then it works like the rest).

-- The original check had no name: find it by its definition.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.academy_resources'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%jsonb_array_length(questions)%';
  if c is not null then
    execute format('alter table public.academy_resources drop constraint %I', c);
  end if;
end $$;

alter table public.academy_resources
  add constraint academy_resources_published_quiz check (
    status <> 'published'
    or jsonb_array_length(questions) = 5
    or (kind = 'podcast' and jsonb_array_length(questions) = 0)
  );
