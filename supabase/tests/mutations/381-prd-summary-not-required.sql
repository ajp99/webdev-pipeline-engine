-- mutation: a second PRD draft needs no change summary
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if (p_content ->> 'change_summary') !~ '\S'
       and exists$q$, $q$if false
       and exists$q$);
