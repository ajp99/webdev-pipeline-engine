-- mutation: a change request of any status allows a new version
select m.patch_fn($q$guard_gated_artifact_version()$q$, $q$c.status = 'accepted'$q$, $q$true$q$);
