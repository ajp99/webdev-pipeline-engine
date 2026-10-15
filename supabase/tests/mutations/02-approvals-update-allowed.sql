-- mutation: guard_approval_change returns instead of raising
select m.patch_fn($q$guard_approval_change()$q$, $q$raise exception 'approvals is append-only';$q$, $q$return new;$q$);
