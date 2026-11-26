-- mutation: an approved summary of any round blocks the next round's summary (the per-round scope removed)
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$and (p_type <> 'round_summary' or a.content->'round' = p_content->'round')$q$, $q$$q$);
select m.patch_fn($q$complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text, jsonb, text)$q$, $q$
                          and (p_type <> 'round_summary' or b.content->'round' = p_content->'round'))$q$, $q$)$q$);
