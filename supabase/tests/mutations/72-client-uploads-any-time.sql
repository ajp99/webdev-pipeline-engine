-- mutation: a client may add uploads in any state
alter policy client_add_uploads on uploads with check (project_id = private.client_project_id() and scan_status = 'pending');
