-- mutation: the owner reads files of every bucket
alter policy owner_intake_objects on storage.objects using (private.is_owner());
