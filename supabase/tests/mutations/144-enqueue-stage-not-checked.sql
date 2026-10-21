-- mutation: enqueue stage not checked
select m.patch_fn($q$enqueue_run(uuid,stage)$q$, $q$if v.stage is distinct from p_stage then$q$, $q$if false then$q$);
