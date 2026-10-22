-- mutation: advance_stage ignores the owner-first order of the prototype stage
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$if 'client' = any (req) and array_length(req, 1) > 1 then$q$, $q$if false then$q$);
