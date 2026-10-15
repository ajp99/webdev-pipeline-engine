-- mutation: advance_stage accepts any next stage
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$if p_next is distinct from stages[idx + 1] then$q$, $q$if false then$q$);
