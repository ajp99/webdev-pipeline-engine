-- mutation: prompt_hash_is_sha256 is dropped
alter table stage_runs drop constraint prompt_hash_is_sha256;
