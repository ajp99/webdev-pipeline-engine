-- mutation: a client may add an upload marked clean
alter policy client_add_uploads on uploads with check (project_id = public.client_project_id());
