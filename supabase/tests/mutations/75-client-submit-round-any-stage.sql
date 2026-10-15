-- mutation: a client may submit a round at any stage
alter policy client_submit_round on intake_rounds using (project_id = public.client_project_id() and status in ('open','submitted')) with check (project_id = public.client_project_id() and status in ('open','submitted'));
