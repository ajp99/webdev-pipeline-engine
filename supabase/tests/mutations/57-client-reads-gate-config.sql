-- mutation: a client policy on gate_config
create policy m_x on gate_config for select to authenticated using (true);
