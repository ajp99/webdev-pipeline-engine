-- mutation: a client policy on email_log
create policy m_x on email_log for select to authenticated using (true);
