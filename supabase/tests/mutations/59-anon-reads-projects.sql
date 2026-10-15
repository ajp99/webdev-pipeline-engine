-- mutation: anon may read projects
create policy m_x on projects for select to anon using (true); grant select on projects to anon;
