-- mutation: a parked run holds the slot
drop index stage_runs_one_active_per_project; create unique index stage_runs_one_active_per_project on stage_runs (project_id) where status in ('running', 'waiting', 'parked');
