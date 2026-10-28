-- mutation: the plan cap is wrong
update gate_config set feedback_cap = 9 where stage = 'plan' and project_id is null and feedback_cap is not null;
