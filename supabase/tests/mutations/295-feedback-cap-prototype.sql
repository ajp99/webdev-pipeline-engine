-- mutation: the prototype cap is wrong
update gate_config set feedback_cap = 9 where stage = 'prototype' and project_id is null and feedback_cap is not null;
