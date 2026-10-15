-- mutation: a client policy on run_logs
create policy m_x on run_logs for select to authenticated using (true);
