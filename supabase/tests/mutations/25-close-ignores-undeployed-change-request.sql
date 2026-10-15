-- mutation: close_project ignores an accepted change request
select m.patch_fn($q$close_project(uuid,close_reason)$q$, $q$if p_reason = 'completed' and exists ($q$, $q$if false and exists ($q$);
