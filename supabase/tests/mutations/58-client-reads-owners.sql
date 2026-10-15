-- mutation: a client policy on owners
create policy m_x on owners for select to authenticated using (true);
