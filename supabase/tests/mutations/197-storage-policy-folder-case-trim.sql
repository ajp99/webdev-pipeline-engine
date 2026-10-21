-- mutation: the project folder is matched ignoring case and spaces
alter policy owner_intake_objects on storage.objects with check (bucket_id = 'intake-uploads' and private.is_owner() and exists (select 1 from public.projects p where p.id::text = lower(trim((storage.foldername(objects.name))[1]))));
