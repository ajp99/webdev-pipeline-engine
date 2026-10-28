-- mutation: the build_rounds cap is wrong
update gate_config set feedback_cap = 9 where stage = 'build_rounds' and project_id is null and feedback_cap is not null;
