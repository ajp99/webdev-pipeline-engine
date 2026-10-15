-- mutation: every run gets the same trace_id
alter table stage_runs alter column trace_id set default '00000000-0000-0000-0000-000000000001';
