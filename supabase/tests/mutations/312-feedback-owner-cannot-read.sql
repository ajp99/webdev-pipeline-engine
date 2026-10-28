-- mutation: the owner cannot read feedback rows
drop policy owner_read_gate_feedback on gate_feedback;
