-- mutation: PRD feedback may point at another project's artifact (the foreign key and the trigger's project
-- check both guard it since Phase 2b, so both go)
alter table prd_feedback drop constraint prd_feedback_artifact_id_project_id_fkey;
select m.patch_fn($q$guard_prd_feedback()$q$, $q$a.id = new.artifact_id and a.project_id = new.project_id and$q$, $q$a.id = new.artifact_id and$q$);
