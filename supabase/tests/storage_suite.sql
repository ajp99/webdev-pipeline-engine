-- Storage checks for P2-T03: the intake-uploads bucket is private and owner-only. Needs t.run, so it
-- is loaded after the fixtures.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P1 '11111111-1111-1111-1111-111111111111'

-- Storage blocks a direct SQL delete unless this setting is on (its protect_delete trigger); the checks
-- below delete on purpose, to test the policy and not the guard.
select set_config('storage.allow_delete_query', 'true', false) \gset

\echo '### intake uploads bucket'
select case when (select public from storage.buckets where id = 'intake-uploads') = false
  then 'PASS      the intake bucket is private' else 'FAIL      the intake bucket is private' end;
select case when (select file_size_limit from storage.buckets where id = 'intake-uploads') = 26214400
  then 'PASS      the bucket limit is 25 MB' else 'FAIL      the bucket limit is 25 MB' end;
-- The bucket and the uploads table must allow the same file types.
select case when (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'intake-uploads')
  = array['application/json','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg','image/png','image/svg+xml','image/webp','text/markdown','text/plain','video/mp4']
  then 'PASS      the bucket allows exactly the allowed upload types' else 'FAIL      the bucket allows exactly the allowed upload types' end;

insert into storage.buckets(id, name) values ('other', 'other');
-- ...and the same as the uploads table's own list, read from its constraint, so the two cannot drift apart.
select case when (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'intake-uploads')
  = (select array(select m[1] from regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') as m order by 1)
       from pg_constraint c where c.conname = 'upload_allowed_types' and c.conrelid = 'public.uploads'::regclass)
  then 'PASS      the bucket types equal the uploads table types' else 'FAIL      the bucket types equal the uploads table types' end;

select t.run('owner stores a file in a project folder', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/a.png'')', 'ok:1');
select t.run('owner cannot store a file outside a project folder', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''99999999-9999-9999-9999-999999999999/logo/a.png'')', 'error');
select t.run('owner cannot store a root file named like the project id', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '.png'')', 'error');
select t.run('owner cannot store in a folder that only starts with the project id', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || 'x/a.png'')', 'error');
select t.run('owner cannot store in a folder with a leading space', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', '' ' || :'P1' || '/a.png'')', 'error');
-- The policy checks the first path segment only: Storage keys are flat strings, so a later "..", or an
-- empty segment, stays inside the project's own folder.
select t.run('owner cannot store a file at the bucket root', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''a.png'')', 'error');
select t.run('owner cannot write to another bucket', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''other'', ''' || :'P1' || '/a.png'')', 'error');
select t.run('a non-owner cannot store a file', :'A'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/b.png'')', 'error');
select t.run('anon cannot store a file', null, 'anon', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/c.png'')', 'error');

-- A stored object that the owner reads, and others cannot.
insert into storage.objects(bucket_id, name) values ('intake-uploads', :'P1' || '/logo/seed.png');
insert into storage.objects(bucket_id, name) values ('other', :'P1' || '/logo/hidden.png');
select t.run('owner reads no file from another bucket', :'O'::uuid, 'authenticated', 'select * from storage.objects where bucket_id = ''other''', 'ok:0');
select t.run('owner cannot move a stored file out of its project folder', :'O'::uuid, 'authenticated', 'update storage.objects set name = ''moved.png'' where bucket_id = ''intake-uploads''', 'error');
select t.run('owner cannot move a stored file to another bucket', :'O'::uuid, 'authenticated', 'update storage.objects set bucket_id = ''other'' where bucket_id = ''intake-uploads''', 'error');
select t.run('owner renames a stored file inside its project folder', :'O'::uuid, 'authenticated', 'update storage.objects set name = name || ''x'' where bucket_id = ''intake-uploads''', 'ok:1');
select t.run('owner reads the stored files', :'O'::uuid, 'authenticated', 'select * from storage.objects where bucket_id = ''intake-uploads''', 'ok:1');
select t.run('a non-owner reads no stored file', :'A'::uuid, 'authenticated', 'select * from storage.objects', 'ok:0');
select t.run('anon reads no stored file', null, 'anon', 'select * from storage.objects', 'ok:0');
select t.run('a non-owner cannot delete a stored file', :'A'::uuid, 'authenticated', 'delete from storage.objects', 'ok:0');
select t.run('a non-owner cannot rename a stored file', :'A'::uuid, 'authenticated', 'update storage.objects set name = name || ''x''', 'ok:0');
select t.run('owner deletes a stored file', :'O'::uuid, 'authenticated', 'delete from storage.objects where bucket_id = ''intake-uploads''', 'ok:1');
