-- mutation: a soft approval releases a handover guide
select m.patch_fn($q$guard_handover_guide_visibility()$q$, $q$ap.gate_type = 'hard' and ap.role = 'owner'$q$, $q$ap.role = 'owner'$q$);
