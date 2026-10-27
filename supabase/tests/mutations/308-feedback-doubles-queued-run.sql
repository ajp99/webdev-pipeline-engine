-- mutation: feedback ignores a run already queued
select m.patch_fn($q$feedback_gate(uuid, uuid, text, int)$q$, $q$and not exists (select 1 from public.stage_runs r where r.project_id = p_project and r.status = 'queued')$q$, $q$$q$);
