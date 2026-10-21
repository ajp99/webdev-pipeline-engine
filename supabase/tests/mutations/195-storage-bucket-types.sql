-- mutation: the intake bucket allows zip files
update storage.buckets set allowed_mime_types = allowed_mime_types || array['application/zip'] where id = 'intake-uploads';
