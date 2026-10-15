-- mutation: a client may read artifacts that are not client-visible
alter policy client_read_visible_artifacts on artifacts using (project_id = private.client_project_id());
