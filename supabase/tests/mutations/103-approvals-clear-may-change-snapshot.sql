-- mutation: clearing the giver may also change the hash and email
select m.patch_fn($q$guard_approval_change()$q$, $q$new.at, new.approved_by_email, new.content_sha256)$q$, $q$new.at)$q$);
select m.patch_fn($q$guard_approval_change()$q$, $q$old.at, old.approved_by_email, old.content_sha256)$q$, $q$old.at)$q$);
