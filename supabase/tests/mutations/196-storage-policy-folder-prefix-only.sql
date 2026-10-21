-- mutation: any name that starts with a project id is accepted
alter policy owner_intake_objects on storage.objects with check (bucket_id = 'intake-uploads' and private.is_owner() and exists (select 1 from public.projects p where objects.name like p.id::text || '%'));
