-- mutation: a run can be ended twice
select m.patch_fn($q$end_run(uuid)$q$, $q$if r.ended_at is not null then$q$, $q$if false then$q$);
