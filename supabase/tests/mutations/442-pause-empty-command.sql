-- mutation: pause-empty-command
select m.patch_fn($q$request_run_approval(uuid, text, text, text)$q$, $q$btrim(coalesce(p_command, '')) = '' or $q$, $q$$q$);
