-- mutation: advance_stage does not require the approvals
select m.patch_fn($q$advance_stage(uuid,stage)$q$, $q$raise exception 'advance_stage: missing % approval on % v% for stage %', gt, atype, art.version, v.stage;$q$, $q$null;$q$);
