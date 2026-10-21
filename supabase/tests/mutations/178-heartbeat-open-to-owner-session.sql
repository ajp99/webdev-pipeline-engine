-- mutation: heartbeat open to owner session
grant execute on function heartbeat_run(uuid, text) to authenticated;
