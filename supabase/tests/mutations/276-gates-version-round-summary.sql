-- mutation: a round summary is gated outside build rounds
select m.patch_fn($q$private.artifact_stage(artifact_type)$q$, $q$when 'round_summary'         then 'build_rounds'$q$, $q$when 'round_summary'         then 'intake'$q$);
