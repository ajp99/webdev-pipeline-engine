-- mutation: a global gate default is missing
delete from gate_config where stage = 'requirements' and project_id is null;
