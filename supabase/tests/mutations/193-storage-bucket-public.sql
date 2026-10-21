-- mutation: the intake bucket is public
update storage.buckets set public = true where id = 'intake-uploads';
