-- mutation: a client may leave PRD feedback at any stage
alter policy client_request_prd_changes on prd_feedback with check (project_id = public.client_project_id() and created_by = auth.uid());
