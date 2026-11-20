-- mutation: a mini-round decision is taken before go-live
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if p_decision is null or p_decision not in ('accept_current_round', 'defer', 'decline') then$q$, $q$if p_decision is null then$q$);
