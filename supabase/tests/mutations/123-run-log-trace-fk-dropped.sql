-- mutation: a log line may carry another run's trace_id
alter table run_logs drop constraint run_logs_trace_matches_run;
