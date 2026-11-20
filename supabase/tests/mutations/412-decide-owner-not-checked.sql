-- mutation: decide_change_request skips the owner check
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if not private.is_owner() then$q$, $q$if false then$q$);
