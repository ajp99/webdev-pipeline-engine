-- mutation: decide-not-owner
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$not private.is_owner()$q$, $q$false$q$);
