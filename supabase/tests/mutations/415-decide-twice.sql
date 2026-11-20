-- mutation: a decided change request is decided again
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if cr.status <> 'received' then$q$, $q$if false then$q$);
