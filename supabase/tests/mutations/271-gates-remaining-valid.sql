-- mutation: an approval by a former owner satisfies the gate
select m.patch_fn($q$remaining_gates(uuid)$q$, $q$              and private.approval_is_valid(ap, pr.id);$q$, $q$;$q$);
