-- mutation: the review saves no follow-up rows
select m.patch_fn($q$complete_intake_review(uuid, int, text, jsonb, jsonb, text)$q$, $q$insert into public.intake_responses (project_id, round, question_id, answer, asked_by, question)
    select p_project, p_round + 1, f->>'id', null, 'agent', f->>'text'
      from jsonb_array_elements(p_followups) f;$q$, $q$null;$q$);
