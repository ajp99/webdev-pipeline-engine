-- mutation: remaining_gates ignores the project filter
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$(p_project is null or p.id = p_project)$q$, $q$true$q$);
