-- mutation: a client policy on project_internal
create policy m_x on project_internal for select to authenticated using (true);
