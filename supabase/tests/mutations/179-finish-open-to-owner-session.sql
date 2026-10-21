-- mutation: finish open to owner session
grant execute on function finish_run(uuid, text, public.run_status, bigint) to authenticated;
