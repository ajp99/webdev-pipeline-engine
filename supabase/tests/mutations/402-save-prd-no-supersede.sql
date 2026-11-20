-- mutation: an owner draft leaves the older draft current
select m.patch_fn($q$save_prd_version(uuid, int, jsonb, uuid)$q$, $q$update public.artifacts set status = 'superseded'$q$, $q$update public.artifacts set status = 'draft'$q$);
