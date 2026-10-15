-- mutation: client_project_not_closed lets a closed project through
select m.patch_fn($q$client_project_not_closed()$q$, $q$p.status <> 'closed'$q$, $q$true$q$);
