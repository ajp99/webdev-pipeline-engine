-- mutation: a client may answer ask-client items at any stage
alter policy client_answer_ask_client_items on backlog_items using (project_id = private.client_project_id() and ask_client) with check (project_id = private.client_project_id() and ask_client);
