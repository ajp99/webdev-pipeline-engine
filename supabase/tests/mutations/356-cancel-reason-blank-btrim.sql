-- mutation: the stored reason is blank-checked with spaces only
alter table project_internal drop constraint cancel_reason_not_blank;
alter table project_internal add constraint cancel_reason_not_blank check (cancel_reason is null or length(btrim(cancel_reason)) > 0);
