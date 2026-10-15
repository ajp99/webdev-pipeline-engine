-- mutation: a client may submit a change request at any stage
alter policy client_submit_change_request on change_requests with check (project_id = private.client_project_id() and submitted_by = 'client' and created_by = auth.uid());
