-- mutation: any signed-in user reads the intake files
alter policy owner_intake_objects on storage.objects using (bucket_id = 'intake-uploads');
