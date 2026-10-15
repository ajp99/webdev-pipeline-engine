-- mutation: advance_stage ignores the approval times in the owner-first order
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$and o.at <= c.at$q$, $q$$q$);
