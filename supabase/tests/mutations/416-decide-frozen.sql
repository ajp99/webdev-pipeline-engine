-- mutation: accepting is allowed after the freeze
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if p_decision = 'accept_current_round' and proj.changes_frozen_at is not null then$q$, $q$if false then$q$);
