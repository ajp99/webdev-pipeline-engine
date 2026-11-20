-- mutation: a paused project's request is decided
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if proj.status <> 'active' then$q$, $q$if false then$q$);
