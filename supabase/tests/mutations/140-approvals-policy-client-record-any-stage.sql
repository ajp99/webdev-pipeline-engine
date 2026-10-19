-- mutation: the owner may record a client-gate approval at any stage and on any artifact
alter policy owner_add_approval on approvals with check (private.is_owner() and approved_by = auth.uid() and exists (select 1 from artifacts a join projects p on p.id = a.project_id where a.id = artifact_id and p.status = 'active'));
