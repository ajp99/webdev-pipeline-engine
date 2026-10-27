-- Row-level security and schema checks (owner-only until go-live, D-298): one t.run(...) line per check.
-- Each check prints PASS or FAIL. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

\echo '### stage intake: reads and project fields'
select t.run('owner reads every project', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'select * from projects', 'ok:2');
select t.run('owner cannot change stage directly', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update projects set stage=''plan'' where id=''11111111-1111-1111-1111-111111111111''', 'error');
select t.run('owner sets token budget', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update project_internal set token_budget=2000000 where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');

\echo '### stage intake: answers, uploads and the open round'
select t.run('upload image/png 5242880 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''image/png'',5242880,''pending'')', 'ok:1');
select t.run('upload image/jpeg 6291456 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''image/jpeg'',6291456,''pending'')', 'error');
select t.run('upload image/svg+xml 6291456 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''image/svg+xml'',6291456,''pending'')', 'error');
select t.run('upload application/pdf 20971520 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''application/pdf'',20971520,''pending'')', 'ok:1');
select t.run('upload application/pdf 27262976 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''application/pdf'',27262976,''pending'')', 'error');
select t.run('upload video/mp4 26214400 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''video/mp4'',26214400,''pending'')', 'ok:1');
select t.run('upload application/zip 1000 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''11111111-1111-1111-1111-111111111111/p'',''application/zip'',1000,''pending'')', 'error');
update intake_rounds set status='submitted' where project_id='11111111-1111-1111-1111-111111111111';
update intake_rounds set status='reviewed' where project_id='11111111-1111-1111-1111-111111111111';

\echo '### stage requirements: PRD sign-off and feedback'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='requirements' where id='11111111-1111-1111-1111-111111111111'; end $$;
update projects set status='paused' where id='11111111-1111-1111-1111-111111111111';
update projects set status='active' where id='11111111-1111-1111-1111-111111111111';

\echo '### stage plan'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='plan' where id='11111111-1111-1111-1111-111111111111'; end $$;

\echo '### stage prototype'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='prototype' where id='11111111-1111-1111-1111-111111111111'; end $$;
-- The prototype's client-gate approval is recorded only after the owner approved that version.
insert into approvals (artifact_id, approved_by, role, gate_type) values ('aaaaaaa1-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a0', 'owner', 'soft');

\echo '### stage build_rounds: ask-client answers, runs and rounds'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='build_rounds' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('owner chooses answer routing', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update backlog_items set answer_action=''immediate_fix'' where ask_client', 'ok:1');
select t.run('a run can move to waiting', null, 'service_role', 'update stage_runs set status=''waiting''', 'ok:1');
select t.run('attempts above 2 rejected', null, 'service_role', 'update stage_runs set attempts=3', 'error');
select t.run('owner records a pause request', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''rewrite_history'',''git push --force'')', 'ok:1');
select t.run('pause request with an unknown kind rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''curl'',''curl x'')', 'error');
select t.run('the owner cannot set a round''s feedback count directly (only feedback_gate)', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update rounds set feedback_count=1', 'error');
select t.run('round claims stored', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update rounds set claims=''[{"id":"c1","text":"Open since 1998"}]''::jsonb', 'ok:1');

\echo '### stage qc_report'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='qc_report' where id='11111111-1111-1111-1111-111111111111'; end $$;

\echo '### stage deploy_prep: final screenshots'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='deploy_prep' where id='11111111-1111-1111-1111-111111111111'; end $$;

\echo '### stage handover: change requests and release notes'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='handover' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('owner records a mini-round decision and status', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set decision=''accept_mini_round'', status=''accepted'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('owner marks a request deployed', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set status=''deployed'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('owner ties a mini-round to a request', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into rounds(project_id,number,branch,change_request_id) select project_id,2,''cr-1'',id from change_requests where project_id=''11111111-1111-1111-1111-111111111111'' limit 1', 'ok:1');
select t.run('status outside the enum rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set status=''shipped'' where project_id=''11111111-1111-1111-1111-111111111111''', 'error');
select t.run('owner cannot write a release-note approval directly; approvals go through accept_gate', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000006'',''00000000-0000-0000-0000-0000000000a0'',''owner'',''hard'')', 'error');

\echo '### closed project'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='closed', status='closed', close_reason='completed' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('owner still reads everything after close', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'select * from comments', 'ok:1');

\echo '### email log'
insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values ('11111111-1111-1111-1111-111111111111','client','a@x','prd_ready','fixture-key');
select t.run('owner records an email', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k1'')', 'ok:1');
select t.run('a duplicate dedupe key is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''fixture-key'')', 'error');
select t.run('the same key twice in one statement is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k2''),(''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k2'')', 'error');
select t.run('an unknown event is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''newsletter'',''k3'')', 'error');
select t.run('an owner alert without a project is allowed', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (null,''owner'',''r@x'',''gate_ready'',''k4'')', 'ok:1');
select t.run('the worker marks an email sent', null, 'service_role', 'update email_log set sent_at=now()', 'ok:1');

\echo '### not the owner: a logged-in user who is not in owners sees and does nothing'
select t.run('a non-owner reads no project', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from projects', 'ok:0');
select t.run('a non-owner reads no artifact', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from artifacts', 'ok:0');
select t.run('a non-owner reads no approval', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from approvals', 'ok:0');
select t.run('a non-owner reads no owner note', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from owner_notes', 'ok:0');
select t.run('a non-owner reads no run log', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from run_logs', 'ok:0');
select t.run('a non-owner cannot add an approval', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000005'',''00000000-0000-0000-0000-0000000000a1'',''owner'',''soft'')', 'error');
select t.run('a non-owner cannot create a project', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into projects(name) values (''X'')', 'error');
select t.run('a non-owner cannot change a project', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update projects set name=''X''', 'ok:0');
select t.run('anon reads nothing', null, 'anon', 'select * from projects', 'error');

\echo '### schema facts'

select 'PASS      24 tables' where (select count(*) from information_schema.tables where table_schema='public')=24
union all select 'FAIL      table count is ' || (select count(*) from information_schema.tables where table_schema='public') where (select count(*) from information_schema.tables where table_schema='public')<>24
union all select 'PASS      stage_runs.cost removed' where not exists (select 1 from information_schema.columns where table_name='stage_runs' and column_name='cost')
union all select 'PASS      token_budget replaces cost_warn_threshold' where not exists (select 1 from information_schema.columns where table_name='projects' and column_name='cost_warn_threshold') and exists (select 1 from information_schema.columns where table_name='project_internal' and column_name='token_budget')
union all select 'PASS      9 gate defaults' where (select count(*) from gate_config where project_id is null)=9
union all select 'PASS      anon holds no table privilege' where not exists (select 1 from information_schema.role_table_grants where grantee='anon' and table_schema='public')
union all select 'FAIL      anon holds a table privilege' where exists (select 1 from information_schema.role_table_grants where grantee='anon' and table_schema='public')
union all select 'PASS      anon can run no function in public' where not exists (select 1 from information_schema.routine_privileges where grantee='anon' and routine_schema='public')
union all select 'FAIL      anon can run a function in public' where exists (select 1 from information_schema.routine_privileges where grantee='anon' and routine_schema='public')
union all select 'PASS      the close and approval-check functions are not callable from the API' where not exists (select 1 from information_schema.routine_privileges where grantee in ('authenticated','service_role','anon') and routine_schema='private' and routine_name in ('close_project','approval_is_valid'))
union all select 'FAIL      the close or approval-check function is callable from the API' where exists (select 1 from information_schema.routine_privileges where grantee in ('authenticated','service_role','anon') and routine_schema='private' and routine_name in ('close_project','approval_is_valid'))
union all select 'PASS      row-level security on every table' where not exists (select 1 from pg_tables where schemaname='public' and not rowsecurity)
union all select case when (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname=x.name) = x.labels::text[] then 'PASS      enum ' else 'FAIL      enum ' end || x.name from (values
    ('change_status', array['received','accepted','deferred','declined','deployed']),
    ('change_decision', array['accept_current_round','accept_mini_round','defer','decline']),
    ('run_status', array['queued','running','waiting','cancel_requested','succeeded','failed','cancelled','stopped']),
    ('artifact_type', array['intake_record','prd','plan','skill_set','round_scope','prototype','round_preview','round_summary','backlog','qc_results','report','deployment_checklist','handover_guide','release_note']),
    ('comment_kind', array['prototype','final_screenshots']),
    ('answer_action', array['next_round','immediate_fix']),
    ('run_approval_status', array['pending','approved','denied'])
  ) as x(name, labels);

