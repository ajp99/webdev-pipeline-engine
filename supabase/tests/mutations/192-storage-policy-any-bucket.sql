-- mutation: the owner policy covers every bucket
alter policy owner_intake_objects on storage.objects with check (private.is_owner());
