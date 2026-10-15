-- mutation: the slot is per stage, not per project
drop index stage_runs_one_active_per_project; create unique index stage_runs_one_active_per_project on stage_runs (project_id, stage) where status in ('running', 'waiting');
