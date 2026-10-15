-- mutation: content_sha256_is_hex is dropped
alter table approvals drop constraint content_sha256_is_hex;
