-- mutation: remaining_gates hides a rejected round summary
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$case when found and art.status = 'rejected' then art.id end, 'round_summary'::public.artifact_type,$q$, $q$null::uuid, 'round_summary'::public.artifact_type,$q$);
