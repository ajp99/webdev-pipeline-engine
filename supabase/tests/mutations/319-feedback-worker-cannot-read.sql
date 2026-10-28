-- mutation: the worker cannot read feedback rows
revoke select on gate_feedback from service_role;
