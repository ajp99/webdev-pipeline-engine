-- mutation: the hash is taken over the wrong text
select m.patch_fn($q$private.stamp_approval_snapshot()$q$, $q$convert_to(a.content::text, 'UTF8')$q$, $q$convert_to(a.id::text, 'UTF8')$q$);
