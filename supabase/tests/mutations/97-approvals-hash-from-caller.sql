-- mutation: an approval keeps a hash the caller sent
select m.patch_fn($q$private.stamp_approval_snapshot()$q$, $q$encode(sha256(convert_to(a.content::text, 'UTF8')), 'hex')$q$, $q$coalesce(new.content_sha256, encode(sha256(convert_to(a.content::text, 'UTF8')), 'hex'))$q$);
