-- mutation: a log line no longer gets its run's trace_id
drop trigger run_logs_default_trace on run_logs;
