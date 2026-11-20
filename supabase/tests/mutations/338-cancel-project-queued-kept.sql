-- mutation: queued runs are not cancelled
select m.patch_fn($q$cancel_project(uuid, text)$q$, $q$when status = 'queued' then 'cancelled'::public.run_status$q$, $q$when false then 'cancelled'::public.run_status$q$);
