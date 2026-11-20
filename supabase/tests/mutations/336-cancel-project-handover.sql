-- mutation: a project at handover can be cancelled
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$if v.stage in ('handover', 'closed') then$q$, $q$if false then$q$);
