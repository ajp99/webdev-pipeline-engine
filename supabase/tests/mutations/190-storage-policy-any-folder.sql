-- mutation: the owner may store a file outside a project folder
alter policy owner_intake_objects on storage.objects with check (bucket_id = 'intake-uploads' and private.is_owner());
