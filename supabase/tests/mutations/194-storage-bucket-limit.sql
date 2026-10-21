-- mutation: the intake bucket has no size limit
update storage.buckets set file_size_limit = 1073741824 where id = 'intake-uploads';
