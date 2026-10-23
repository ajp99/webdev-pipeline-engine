-- mutation: reject_gate leaves the version a draft
select m.patch_fn($q$reject_gate(uuid, uuid, int)$q$, $q$update public.artifacts set status = 'rejected' where id = art.id;$q$, $q$update public.artifacts set status = 'draft' where id = art.id;$q$);
