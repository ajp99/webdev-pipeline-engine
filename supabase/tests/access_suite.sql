-- Extra access checks for P1-T08. Needs t.run and t.adv, so it is loaded after the other suites.
-- Supabase grants table privileges to anon and authenticated by default and relies on row-level
-- security alone; the grant below copies that, so these checks test the policies and not a missing grant.
grant select, insert, update, delete on all tables in schema public to anon;
grant usage on schema t to anon;
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P1 '11111111-1111-1111-1111-111111111111'

\echo '### anon, owners, templates, config'
select t.run('anon reads no projects', null, 'anon', 'select * from projects', 'ok:0');
select t.run('anon reads no artifacts', null, 'anon', 'select * from artifacts', 'ok:0');
select t.run('anon reads no intake responses', null, 'anon', 'select * from intake_responses', 'ok:0');
select t.run('anon reads no approvals', null, 'anon', 'select * from approvals', 'ok:0');
select t.run('anon cannot create a project', null, 'anon', 'insert into projects(name) values (''x'')', 'error');
select t.run('anon cannot approve anything', null, 'anon', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-0000000000a1'', ''client'', ''client'')', 'error');
select t.run('client A cannot read the owners table', :'A'::uuid, 'authenticated', 'select * from owners', 'ok:0');
select t.run('client A cannot make themselves an owner', :'A'::uuid, 'authenticated', 'insert into owners(id) values (''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('owner reads the owners table', :'O'::uuid, 'authenticated', 'select * from owners', 'ok:1');
select t.run('client A cannot read intake templates', :'A'::uuid, 'authenticated', 'select * from intake_templates', 'ok:0');
select t.run('client A cannot read gate config', :'A'::uuid, 'authenticated', 'select * from gate_config', 'ok:0');
select t.run('client A cannot change gate config', :'A'::uuid, 'authenticated', 'update gate_config set escalate_after_hours = 1', 'ok:0');
select t.run('client A cannot read run logs', :'A'::uuid, 'authenticated', 'select * from run_logs', 'ok:0');
select t.run('client A cannot read skill uses', :'A'::uuid, 'authenticated', 'select * from skill_uses', 'ok:0');
select t.run('client A cannot read the skills registry', :'A'::uuid, 'authenticated', 'select * from skills_registry', 'ok:0');
select t.run('client A cannot read QC runs', :'A'::uuid, 'authenticated', 'select * from qc_runs', 'ok:0');
select t.run('client A cannot read run approvals', :'A'::uuid, 'authenticated', 'select * from run_approvals', 'ok:0');
select t.run('client A reads their own template snapshot', :'A'::uuid, 'authenticated', 'select intake_template_snapshot from projects where id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('client A cannot read the other project''s snapshot', :'A'::uuid, 'authenticated', 'select intake_template_snapshot from projects where id=''22222222-2222-2222-2222-222222222222''', 'ok:0');

\echo '### approvals are append-only'
select t.run('owner cannot edit an approval', :'O'::uuid, 'authenticated', 'update approvals set gate_type=''hard'', role=''owner''', 'error');
select t.run('owner cannot delete an approval', :'O'::uuid, 'authenticated', 'delete from approvals', 'error');
select t.run('the worker cannot edit an approval', null, 'service_role', 'update approvals set at = now()', 'error');
select t.run('the worker cannot delete an approval', null, 'service_role', 'delete from approvals', 'error');

\echo '### uploads and rounds'
select t.run('a macro-enabled document is rejected', :'O'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/vnd.ms-word.document.macroEnabled.12'',1000)', 'error');
select t.run('a macro-enabled spreadsheet is rejected', :'O'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/vnd.ms-excel.sheet.macroEnabled.12'',1000)', 'error');
select t.run('an executable is rejected', :'O'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/x-msdownload'',1000)', 'error');
select t.run('client A cannot mark an upload clean', :'A'::uuid, 'authenticated', 'update uploads set scan_status=''clean''', 'ok:0');
select t.run('client A cannot mark an upload infected or pending', :'A'::uuid, 'authenticated', 'update uploads set scan_status=''pending''', 'ok:0');
select t.run('owner can set the scan result', :'O'::uuid, 'authenticated', 'update uploads set scan_status=''infected''', 'ok:1');
select t.run('the worker can set the scan result', null, 'service_role', 'update uploads set scan_status=''infected''', 'ok:1');
select t.adv('client A cannot mark a submitted intake round reviewed', 'update intake_rounds set status=''submitted''', :'A', 'authenticated', 'update intake_rounds set status=''reviewed'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok', '(select status::text from intake_rounds where project_id=''11111111-1111-1111-1111-111111111111'')=''submitted''');
select t.adv('owner can mark a submitted intake round reviewed', 'update intake_rounds set status=''submitted''', :'O', 'authenticated', 'update intake_rounds set status=''reviewed'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok', '(select status::text from intake_rounds where project_id=''11111111-1111-1111-1111-111111111111'')=''reviewed''');

\echo '### queue claim'
select t.adv('the worker claims exactly one queued run', 'insert into stage_runs(project_id,stage,status,queued_at) values (''11111111-1111-1111-1111-111111111111'',''intake'',''queued'',now()-interval ''2 min''),(''11111111-1111-1111-1111-111111111111'',''plan'',''queued'',now()-interval ''1 min'')', null, 'service_role',
  'with c as (select id from stage_runs where status=''queued'' order by queued_at limit 1 for update skip locked) update stage_runs s set status=''running'', claimed_by=''w1'', heartbeat_at=now(), attempts=attempts+1 from c where s.id=c.id', 'ok',
  '(select count(*) from stage_runs where claimed_by=''w1'')=1 and (select stage::text from stage_runs where claimed_by=''w1'')=''intake'' and (select count(*) from stage_runs where status=''queued'')=1');
select t.adv('a client cannot claim a run', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''intake'',''queued'')', :'A', 'authenticated',
  'update stage_runs set status=''running'', claimed_by=''x''', 'ok', '(select count(*) from stage_runs where claimed_by=''x'')=0');

\echo '### the console Accept sequence (P1-T06): approval, artifact approved, advance, all as the owner'
select t.adv('the owner can run the Accept sequence for a plan', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'insert into approvals(artifact_id,approved_by,role,gate_type) select id, ''00000000-0000-0000-0000-0000000000a0'', ''owner'', ''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan'';
   update artifacts set status=''approved'' where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan'';
   select advance_stage(''cccccccc-0000-0000-0000-000000000001'', ''prototype'')', 'ok',
  '(select stage::text from projects where id=''cccccccc-0000-0000-0000-000000000001'')=''prototype'' and (select status::text from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan'')=''approved''');
select t.adv('the owner reads the queue inputs', t.proj('plan'), :'O', 'authenticated',
  'select (select count(*) from projects)+(select count(*) from gate_config)+(select count(*) from artifacts)+(select count(*) from approvals)+(select count(*) from rounds)', 'ok');
