-- mutation: the cap has no upper bound
alter table gate_config drop constraint gate_config_feedback_cap_check;
