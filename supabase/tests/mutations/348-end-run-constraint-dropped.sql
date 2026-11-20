-- mutation: ended_at is allowed on any run
alter table stage_runs drop constraint run_ended_only_when_over;
