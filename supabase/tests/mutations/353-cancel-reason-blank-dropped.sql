-- mutation: the stored reason may be blank
alter table project_internal drop constraint cancel_reason_not_blank;
