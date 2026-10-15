-- mutation: an approval keeps an email the caller sent
select m.patch_fn($q$private.stamp_approval_snapshot()$q$, $q$select u.email into new.approved_by_email from auth.users u where u.id = new.approved_by;$q$, $q$select coalesce(new.approved_by_email, u.email) into new.approved_by_email from auth.users u where u.id = new.approved_by;$q$);
