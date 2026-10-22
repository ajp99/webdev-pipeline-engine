-- Checks for the review-panel hardening (task P1-T17, D-263 to D-309). Loaded after coverage_suite.sql,
-- which defines t.none. Each rule here has a deliberate break in supabase/tests/mutations/.
\set O '00000000-0000-0000-0000-0000000000a0'
\set D '00000000-0000-0000-0000-0000000000d1'
\set P 'cccccccc-0000-0000-0000-000000000001'

\echo '### hardening: approvals record the content hash and the giver''s email (D-265, D-269)'
select t.adv('an approval stores the SHA-256 of the artifact content and the giver''s email', t.proj('plan')||';'||t.art('plan',1,'draft','{"a": 1}'), :'O', 'authenticated',
  'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where project_id='''||:'P'||''' and type=''plan''', 'ok',
  '(select ap.content_sha256 = encode(sha256(convert_to(a.content::text,''UTF8'')),''hex'') and ap.approved_by_email = ''owner@x'' from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'P'||''')');
select t.adv('a different content gives a different hash', t.proj('plan')||';'||t.art('plan',1,'superseded','{"a": 1}')||';'||t.art('plan',2,'draft','{"a": 2}')||';'||t.appr('plan',1,'soft')||';'||t.appr('plan',2,'soft'), :'O', 'authenticated', 'select 1', 'ok',
  '(select count(distinct content_sha256) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'P'||''')=2');
select t.adv('values sent with an approval are replaced by the database''s', t.proj('plan')||';'||t.art('plan',1,'draft','{"a": 1}'), null, 'service_role',
  'insert into approvals(artifact_id,approved_by,approved_by_email,content_sha256,role,gate_type) select id,'''||:'O'||''',''forged@x'','''||repeat('0',64)||''',''owner'',''soft'' from artifacts where project_id='''||:'P'||''' and type=''plan''', 'ok',
  '(select ap.content_sha256 <> repeat(''0'',64) and ap.approved_by_email = ''owner@x'' from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'P'||''')');
select t.adv('the email snapshot stays when the giver and the login are deleted (D-309)', t.proj('plan')||';'||t.art('plan')||';insert into auth.users(id,email) values (''00000000-0000-0000-0000-0000000000d1'',''d@x'');insert into owners(id) values (''00000000-0000-0000-0000-0000000000d1'');'||t.appr('plan',1,'soft',0,'00000000-0000-0000-0000-0000000000d1')||';delete from owners where id='''||:'D'||''';delete from auth.users where id='''||:'D'||'''', :'O', 'authenticated', 'select 1', 'ok',
  '(select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'P'||''' and ap.approved_by='''||:'D'||''' and ap.approved_by_email = ''d@x'')=1');
select t.adv('a direct update cannot change the stored hash', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', 'update approvals set content_sha256 = repeat(''0'',64)', 'error:append-only');
select t.adv('deleting a login cannot be used to rewrite the snapshot', t.proj('plan')||';'||t.art('plan')||';insert into auth.users(id,email) values (''00000000-0000-0000-0000-0000000000d1'',''d@x'');insert into owners(id) values (''00000000-0000-0000-0000-0000000000d1'');'||t.appr('plan',1,'soft',0,'00000000-0000-0000-0000-0000000000d1')||
  $s$;create function public.evil() returns trigger language plpgsql as $f$ begin update public.approvals set approved_by = null, approved_by_email = 'forged@x'; return old; end $f$;create trigger evil before delete on auth.users for each row execute function public.evil()$s$,
  null, current_user, 'delete from auth.users where id = '''||:'D'||'''', 'error:append-only', null);
select t.adv('the table refuses a malformed hash even if the trigger is skipped', t.proj('plan')||';'||t.art('plan')||';set local session_replication_role = replica', null, 'service_role',
  'insert into approvals(artifact_id,approved_by,role,gate_type,content_sha256) select id,'''||:'O'||''',''owner'',''soft'',''abc'' from artifacts where project_id='''||:'P'||''' and type=''plan''', 'error:content_sha256');
select t.adv('the table refuses an approval with no hash even if the trigger is skipped', t.proj('plan')||';'||t.art('plan')||';set local session_replication_role = replica', null, 'service_role',
  'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where project_id='''||:'P'||''' and type=''plan''', 'error:content_sha256');

\echo '### hardening: gate_config and the gatekeeper (D-272)'
select t.adv('owner cannot delete a global gate default', 'select 1', :'O', 'authenticated', 'delete from gate_config where stage=''requirements'' and project_id is null', 'error:cannot be deleted');
select t.adv('the worker cannot delete a global gate default', 'select 1', null, 'service_role', 'delete from gate_config where stage=''requirements'' and project_id is null', 'error:cannot be deleted');
select t.adv('owner cannot add a global gate default', 'select 1', :'O', 'authenticated', 'insert into gate_config(stage,gate_type,gatekeeper) values (''plan'',''hard'',''owner'')', 'error:migration');
select t.adv('owner cannot turn the client gate of the PRD into an owner gate', 'select 1', :'O', 'authenticated', 'update gate_config set gate_type=''soft'', gatekeeper=''owner'' where stage=''requirements'' and project_id is null', 'error:only its deadline');
select t.adv('owner can change the deadline of a global gate', 'select 1', :'O', 'authenticated', 'update gate_config set escalate_after_hours=48 where stage=''plan'' and project_id is null', 'ok', '(select escalate_after_hours from gate_config where stage=''plan'' and project_id is null)=48');
select t.adv('owner can add a stricter gate for one project', t.proj('plan'), :'O', 'authenticated', 'insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'P'||''',''hard'',''owner'')', 'ok');
select t.adv('owner can remove a project gate row', t.proj('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'P'||''',''hard'',''owner'')', :'O', 'authenticated', 'delete from gate_config where project_id='''||:'P'||'''', 'ok');
select t.adv('a project gate row cannot be turned into a global one', t.proj('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'P'||''',''hard'',''owner'')', :'O', 'authenticated', 'update gate_config set project_id=null where project_id='''||:'P'||'''', 'error:only its deadline');
select t.adv('a soft gate cannot be given to the client', t.proj('plan'), :'O', 'authenticated', 'insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'P'||''',''soft'',''client'')', 'error:gatekeeper_matches_gate');
select t.adv('the table itself refuses a client gate held by the owner', 'select 1', null, current_user, 'insert into gate_config(stage,gate_type,gatekeeper) values (''deploy_prep'',''client'',''owner'')', 'error:gatekeeper_matches_gate');
select t.adv('a migration (the SQL editor role) can still change a global gate default', 'select 1', null, current_user, 'update gate_config set escalate_after_hours=12 where stage=''plan'' and project_id is null', 'ok', '(select escalate_after_hours from gate_config where stage=''plan'' and project_id is null)=12');
select t.adv('advance_stage needs the approval in the role of the gatekeeper (client gate held by the owner)', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client')||';alter table gate_config drop constraint gatekeeper_matches_gate;update gate_config set gatekeeper=''owner'' where stage=''requirements'' and project_id is null', :'O', 'authenticated', t.go('plan'), 'error:missing client approval');
select t.adv('advance_stage needs the approval in the role of the gatekeeper (soft gate held by the client)', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft')||';alter table gate_config drop constraint gatekeeper_matches_gate;update gate_config set gatekeeper=''client'' where stage=''plan'' and project_id is null', :'O', 'authenticated', t.go('prototype'), 'error:missing soft approval');
select t.adv('the project''s own gatekeeper row wins over the global default', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft')||';alter table gate_config drop constraint gatekeeper_matches_gate;insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'P'||''',''soft'',''client'')', :'O', 'authenticated', t.go('prototype'), 'error:missing soft approval');
select t.adv('with the default gatekeeper an owner approval still advances a soft gate', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.go('prototype'), 'ok', '('||t.cs()||')=''prototype''');

\echo '### hardening: runs and their logs (D-278, D-281, D-283)'
select t.adv('a second running run for the same project is refused', 'select 1', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''plan'',''running'')', 'error:stage_runs_one_active_per_project');
select t.adv('a waiting run holds the slot too', 'update stage_runs set status=''waiting''', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''plan'',''running'')', 'error:stage_runs_one_active_per_project');
select t.adv('queued runs do not hold the slot', 'select 1', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''plan'',''queued''),(''11111111-1111-1111-1111-111111111111'',''prototype'',''queued'')', 'ok');
select t.adv('a cancelled run frees the slot', 'update stage_runs set status=''cancelled''', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''plan'',''running'')', 'ok');
select t.adv('a cancel_requested run still holds the slot', 'update stage_runs set status=''cancel_requested''', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''11111111-1111-1111-1111-111111111111'',''plan'',''running'')', 'error:stage_runs_one_active_per_project');
select t.adv('another project can run at the same time', 'select 1', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''22222222-2222-2222-2222-222222222222'',''plan'',''running'')', 'ok');
select t.adv('each run gets its own trace_id', 'select 1', null, 'service_role', 'insert into stage_runs(project_id,stage,status) values (''22222222-2222-2222-2222-222222222222'',''plan'',''queued''),(''22222222-2222-2222-2222-222222222222'',''prototype'',''queued'')', 'ok', '(select count(distinct trace_id) from stage_runs)=3');
select t.adv('the worker records the model and prompt hash of a run', 'select 1', null, 'service_role', 'update stage_runs set model=''claude-sonnet-5-5'', prompt_hash=repeat(''a'',64)', 'ok', '(select prompt_hash from stage_runs)=repeat(''a'',64)');
select t.adv('a blank model is refused', 'select 1', null, 'service_role', 'update stage_runs set model=''  ''', 'error:model_not_blank');
select t.adv('a prompt hash that is not a SHA-256 is refused', 'select 1', null, 'service_role', 'update stage_runs set prompt_hash=''abc''', 'error:prompt_hash_is_sha256');
select t.adv('a log line gets its run''s trace_id', 'select 1', null, 'service_role', 'insert into run_logs(run_id,message) values (''33333333-3333-3333-3333-333333333333'',''hello'')', 'ok',
  '(select l.trace_id = s.trace_id from run_logs l join stage_runs s on s.id=l.run_id)');
select t.adv('a log line cannot carry another run''s trace_id', 'select 1', null, 'service_role', 'insert into run_logs(run_id,trace_id,message) values (''33333333-3333-3333-3333-333333333333'',gen_random_uuid(),''hello'')', 'error:run_logs_trace_matches_run');

\echo '### hardening: private schema and empty search_path (D-271)'
select case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false))
  then 'PASS      every security-definer function has an empty search_path'
  else 'FAIL      a security-definer function has no empty search_path: ' || (select string_agg(n.nspname||'.'||p.proname, ', ') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)) end;
select case when not has_schema_privilege('anon', 'private', 'usage') and not has_schema_privilege('public', 'private', 'usage')
  then 'PASS      anon cannot use the private schema' else 'FAIL      anon or PUBLIC can use the private schema' end;
select case when has_schema_privilege('authenticated', 'private', 'usage') and has_schema_privilege('service_role', 'private', 'usage')
  then 'PASS      the API roles can use the private schema (policies need it)' else 'FAIL      an API role cannot use the private schema' end;
-- The public functions the API roles can run, per role (D-264, D-302). Anything new must be added here on purpose.
select case when (select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
      and has_function_privilege('authenticated', p.oid, 'execute'))
    = array['advance_stage','enqueue_run','request_run_cancel']
  then 'PASS      the owner session can call only advance_stage, enqueue_run and request_run_cancel'
  else 'FAIL      the owner session can call: ' || (select string_agg(p.proname::text, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
      and has_function_privilege('authenticated', p.oid, 'execute')) end;
select case when (select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
      and has_function_privilege('service_role', p.oid, 'execute'))
    = array['advance_stage','claim_run','complete_intake_review','enqueue_run','finish_run','heartbeat_run']
  then 'PASS      the worker can call the four queue functions it uses, complete_intake_review and advance_stage, nothing else'
  else 'FAIL      the worker can call: ' || (select string_agg(p.proname::text, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
      and has_function_privilege('service_role', p.oid, 'execute')) end;
select case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('claim_run','heartbeat_run','finish_run','complete_intake_review')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
  then 'PASS      the worker-only functions are closed to anon and the owner session'
  else 'FAIL      anon or the owner session can run a worker-only function' end;
select case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('enqueue_run','claim_run','heartbeat_run','finish_run','request_run_cancel','complete_intake_review')
      and has_function_privilege('anon', p.oid, 'execute'))
  then 'PASS      anon, and PUBLIC, can run none of the queue functions'
  else 'FAIL      anon or PUBLIC can run a queue function' end;
