-- mutation: cancel_reason_not_blank is dropped
alter table project_internal drop constraint cancel_reason_not_blank;
