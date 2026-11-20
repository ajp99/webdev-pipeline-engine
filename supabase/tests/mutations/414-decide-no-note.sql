-- mutation: a decision needs no impact note
select m.patch_fn($q$decide_change_request(uuid, public.change_decision, text)$q$, $q$if p_impact_note is null or p_impact_note !~ '\S' or length(p_impact_note) > 2000 then$q$, $q$if false then$q$);
