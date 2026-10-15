-- mutation: a run gets no trace_id by default
alter table stage_runs alter column trace_id drop default;
