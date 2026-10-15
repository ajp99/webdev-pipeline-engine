-- mutation: an artifact may name another project's change request
alter table artifacts drop constraint artifacts_change_request_id_project_id_fkey;
