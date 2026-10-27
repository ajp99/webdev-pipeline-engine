-- mutation: feedback queues no run for a stage with an agent
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$perform public.enqueue_run(p_project, v.stage);$q$, $q$null;$q$);
