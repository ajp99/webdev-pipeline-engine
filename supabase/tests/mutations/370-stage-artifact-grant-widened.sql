-- mutation: the owner session may call complete_stage_artifact
grant execute on function complete_stage_artifact(uuid, uuid, text, public.artifact_type, jsonb, text) to authenticated;
