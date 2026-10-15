-- mutation: the PRD gate is given to the owner
update gate_config set gate_type = 'soft', gatekeeper = 'owner' where stage = 'requirements' and project_id is null;
