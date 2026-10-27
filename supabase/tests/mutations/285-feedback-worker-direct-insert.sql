-- mutation: the worker may write feedback rows directly
grant insert on gate_feedback to service_role;
