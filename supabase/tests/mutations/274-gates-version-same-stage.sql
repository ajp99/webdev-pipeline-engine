-- mutation: a new version is refused in the stage itself
select m.patch_fn($q$guard_gated_artifact_version()$q$, $q$array_position(stages, cur) <= array_position(stages, gated)$q$, $q$array_position(stages, cur) < array_position(stages, gated)$q$);
