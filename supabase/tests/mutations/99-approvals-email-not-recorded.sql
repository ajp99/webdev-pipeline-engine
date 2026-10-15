-- mutation: the giver's email is not recorded
select m.patch_fn($q$private.stamp_approval_snapshot()$q$, $q$select u.email into new.approved_by_email from auth.users u where u.id = new.approved_by;$q$, $q$null;$q$);
