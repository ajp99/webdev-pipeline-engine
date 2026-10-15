-- mutation: a client may comment at any stage and set a disposition
alter policy client_add_comment on comments with check (project_id = private.client_project_id() and created_by = auth.uid());
