-- mutation: approval_is_valid does not require the named signer
select m.patch_fn($q$private.approval_is_valid(public.approvals,uuid)$q$, $q$c.project_id = p_project and c.is_signer$q$, $q$c.project_id = p_project$q$);
