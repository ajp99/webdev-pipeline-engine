-- mutation: a client may write answers in a closed round
alter policy client_write_responses on intake_responses with check (project_id = public.client_project_id());
