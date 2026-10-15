-- mutation: a comment may point at another project's artifact
alter table comments drop constraint comments_artifact_id_project_id_fkey;
