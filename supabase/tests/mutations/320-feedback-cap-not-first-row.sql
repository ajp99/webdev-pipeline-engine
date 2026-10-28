-- mutation: the cap is read from the last gate row, not the first
select m.patch_fn($q$private.feedback_cap(uuid, public.stage)$q$, $q$where g.stage = p_stage and g.project_id is null and g.feedback_cap is not null
      order by g.gate_type limit 1$q$, $q$where g.stage = p_stage and g.project_id is null
      order by g.gate_type desc limit 1$q$);
