-- mutation: PRD feedback may point at another project's artifact
alter table prd_feedback drop constraint prd_feedback_artifact_id_project_id_fkey;
