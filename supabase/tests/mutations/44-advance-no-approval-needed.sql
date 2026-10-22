-- mutation: advance_stage does not require the approvals
select m.patch_fn($q$private.advance_blocker(uuid)$q$, $q$return format('missing %s approval on %s v%s for stage %s', gt, atype, art.version, v.stage);$q$, $q$null;$q$);
