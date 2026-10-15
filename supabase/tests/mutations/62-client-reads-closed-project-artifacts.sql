-- mutation: a client may read every artifact after close
alter policy client_read_visible_artifacts on artifacts using (project_id = public.client_project_id() and client_visible);
