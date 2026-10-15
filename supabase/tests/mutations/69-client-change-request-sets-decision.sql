-- mutation: a client may set the decision on a change request
alter policy client_submit_change_request on change_requests with check (project_id = public.client_project_id() and submitted_by = 'client' and created_by = auth.uid() and status = 'received' and public.client_project_in(array['handover']::stage[]));
