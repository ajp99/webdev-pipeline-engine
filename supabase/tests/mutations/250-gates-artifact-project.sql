-- mutation: a gate artifact may belong to another project
select m.patch_fn($q$private.current_gate_artifact(uuid, uuid, int, text, boolean)$q$, $q$select * into art from public.artifacts where id = p_artifact and project_id = p_project;$q$, $q$select * into art from public.artifacts where id = p_artifact;$q$);
