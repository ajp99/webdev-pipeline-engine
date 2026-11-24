-- mutation: pause-any-kind
select m.patch_fn($q$request_run_approval(uuid, text, text, text)$q$, $q$p_kind is null or p_kind not in ('delete_files', 'rewrite_history')$q$, $q$false$q$);
