-- mutation: any text is accepted as a prompt hash (the table check still refuses it, so the message changes)
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$if p_prompt_hash is not null and p_prompt_hash !~ '^[0-9a-f]{64}$' then$q$, $q$if false then$q$);
