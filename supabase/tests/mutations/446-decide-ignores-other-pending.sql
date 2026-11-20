-- mutation: decide-ignores-other-pending
select m.patch_fn($q$decide_run_approval(uuid, boolean)$q$, $q$if not exists (select 1 from public.run_approvals where run_id = a.run_id and status = 'pending') then$q$, $q$if true then$q$);
