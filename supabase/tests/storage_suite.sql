-- Storage checks for P2-T03: the intake-uploads bucket is private and owner-only. Needs t.run, so it
-- is loaded after the fixtures.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P1 '11111111-1111-1111-1111-111111111111'

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
select t.run('owner stores a file in a project folder', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/a.png'')', 'ok:1');
select t.run('owner cannot store a file outside a project folder', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''99999999-9999-9999-9999-999999999999/logo/a.png'')', 'error');
select t.run('owner cannot store a file at the bucket root', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''a.png'')', 'error');
select t.run('owner cannot write to another bucket', :'O'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''other'', ''' || :'P1' || '/a.png'')', 'error');
select t.run('a non-owner cannot store a file', :'A'::uuid, 'authenticated', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/b.png'')', 'error');
select t.run('anon cannot store a file', null, 'anon', 'insert into storage.objects(bucket_id,name) values (''intake-uploads'', ''' || :'P1' || '/logo/c.png'')', 'error');

-- A stored object that the owner reads, and others cannot.
insert into storage.objects(bucket_id, name) values ('intake-uploads', :'P1' || '/logo/seed.png');
select t.run('owner reads the stored files', :'O'::uuid, 'authenticated', 'select * from storage.objects where bucket_id = ''intake-uploads''', 'ok:1');
select t.run('a non-owner reads no stored file', :'A'::uuid, 'authenticated', 'select * from storage.objects', 'ok:0');
select t.run('anon reads no stored file', null, 'anon', 'select * from storage.objects', 'ok:0');
select t.run('a non-owner cannot delete a stored file', :'A'::uuid, 'authenticated', 'delete from storage.objects', 'ok:0');
select t.run('a non-owner cannot rename a stored file', :'A'::uuid, 'authenticated', 'update storage.objects set name = name || ''x''', 'ok:0');
select t.run('owner deletes a stored file', :'O'::uuid, 'authenticated', 'delete from storage.objects where bucket_id = ''intake-uploads''', 'ok:1');
