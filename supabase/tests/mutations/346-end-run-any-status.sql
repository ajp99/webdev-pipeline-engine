-- mutation: a run in any state can be ended (the function's check)
select m.patch_fn($q$end_run(uuid)$q$, $q$if r.status not in ('failed', 'stopped') then$q$, $q$if false then$q$);
