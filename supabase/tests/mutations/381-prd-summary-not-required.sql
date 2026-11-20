-- mutation: a second PRD draft needs no change summary
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb)$q$, $q$if btrim(p_content ->> 'change_summary') = ''$q$, $q$if false$q$);
