-- mutation: the deploy_prep cap is wrong
update gate_config set feedback_cap = 9 where stage = 'deploy_prep' and project_id is null and feedback_cap is not null;
