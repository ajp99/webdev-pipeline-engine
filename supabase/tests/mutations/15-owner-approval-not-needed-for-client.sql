-- mutation: the client may sign the prototype before the owner
select m.patch_fn($q$private.artifact_has_owner_approval(uuid)$q$, $q$select exists (select 1 from public.approvals ap where ap.artifact_id = p_artifact and ap.role = 'owner')$q$, $q$select true$q$);
