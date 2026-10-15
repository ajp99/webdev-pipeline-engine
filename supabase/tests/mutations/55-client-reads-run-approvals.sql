-- mutation: a client policy on run_approvals
create policy m_x on run_approvals for select to authenticated using (true);
