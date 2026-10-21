-- mutation: cancel running run ends at once
select m.patch_fn($q$request_run_cancel(uuid)$q$, $q$final := 'cancel_requested';
    update$q$, $q$final := 'cancelled';
    update$q$);
