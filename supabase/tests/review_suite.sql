-- Checks for the migration review of 2026-10-15 (hardening folded into 0001 and 0002).
-- Needs t.run, t.adv and the t.* setup builders, so it is loaded after the other suites.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set C '00000000-0000-0000-0000-0000000000c1'

\echo '### owner-only project fields and project guards'
select t.run('client A cannot read project_internal', :'A'::uuid, 'authenticated', 'select * from project_internal', 'ok:0');
select t.run('owner reads project_internal', :'O'::uuid, 'authenticated', 'select * from project_internal', 'ok:2');
select t.run('owner sets the repo and the round plan', :'O'::uuid, 'authenticated', 'update project_internal set github_repo=''o/r'', round_plan=''[]'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('client A cannot set the repo', :'A'::uuid, 'authenticated', 'update project_internal set github_repo=''x/y''', 'ok:0');
select t.run('client A cannot select round_plan from projects (column moved)', :'A'::uuid, 'authenticated', 'select round_plan from projects', 'error');
select t.adv('owner creates a project at intake and it gets an internal row', 'select 1', :'O', 'authenticated', 'insert into projects(id,name) values (''eeeeeeee-0000-0000-0000-000000000001'',''N'')', 'ok', '(select count(*) from project_internal where project_id=''eeeeeeee-0000-0000-0000-000000000001'')=1');
select t.adv('owner cannot create a project at the plan stage', 'select 1', :'O', 'authenticated', 'insert into projects(name,stage) values (''N'',''plan'')', 'error:starts active');
select t.adv('owner cannot create a project that is already closed', 'select 1', :'O', 'authenticated', 'insert into projects(name,status,close_reason) values (''N'',''closed'',''completed'')', 'error:starts active');
select t.adv('owner can pause and resume', t.proj('plan'), :'O', 'authenticated', 'update projects set status=''paused'' where id=''cccccccc-0000-0000-0000-000000000001''; update projects set status=''active'' where id=''cccccccc-0000-0000-0000-000000000001''', 'ok');
select t.adv('owner cannot close a project by a direct update', t.proj('plan'), :'O', 'authenticated', 'update projects set status=''closed'', close_reason=''cancelled'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close function');
select t.adv('the worker cannot close a project by a direct update', t.proj('plan'), null, 'service_role', 'update projects set status=''closed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close function');
select t.adv('owner cannot reopen a closed project', t.proj('closed','closed'), :'O', 'authenticated', 'update projects set status=''active'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close function');
select t.adv('owner cannot set a close reason on an open project', t.proj('plan'), :'O', 'authenticated', 'update projects set close_reason=''completed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error');
select t.adv('close_project cannot be called by the owner', t.proj('plan'), :'O', 'authenticated', 'select close_project(''cccccccc-0000-0000-0000-000000000001'', ''cancelled'')', 'error');
select t.adv('close_project cannot be called by the worker', t.proj('plan'), null, 'service_role', 'select close_project(''cccccccc-0000-0000-0000-000000000001'', ''cancelled'')', 'error');
select t.adv('closing sets retention_until from retention_days', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard')||';update project_internal set retention_days=30 where project_id=''cccccccc-0000-0000-0000-000000000001''', :'O', 'authenticated', t.go('closed'), 'ok',
  '(select retention_until from project_internal where project_id=''cccccccc-0000-0000-0000-000000000001'') between now()+interval ''29 days'' and now()+interval ''31 days''');
select t.adv('closing is refused while an accepted change request is undeployed', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard')||';insert into change_requests(project_id,description,status,decision) values (''cccccccc-0000-0000-0000-000000000001'',''cr'',''accepted'',''accept_mini_round'')', :'O', 'authenticated', t.go('closed'), 'error:not deployed');
select t.adv('a failed close leaves the stage where it was', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard')||';insert into change_requests(project_id,description,status,decision) values (''cccccccc-0000-0000-0000-000000000001'',''cr'',''accepted'',''accept_mini_round'')', :'O', 'authenticated', 'do $x$ begin begin perform advance_stage(''cccccccc-0000-0000-0000-000000000001'',''closed''); exception when others then null; end; end $x$', 'ok', '(' || t.cs() || ')=''handover''');
select t.adv('closing is allowed once the accepted request is deployed', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard')||';insert into change_requests(project_id,description,status,decision) values (''cccccccc-0000-0000-0000-000000000001'',''cr'',''deployed'',''accept_mini_round'')', :'O', 'authenticated', t.go('closed'), 'ok');

\echo '### approvals: who may write, server time, once only, kept when a login is deleted'
select t.adv('owner cannot record an approval as someone else', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'C'||''',''owner'',''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error');
select t.adv('owner cannot record a client-role approval', t.proj('requirements')||';'||t.art('prd'), :'O', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''client'',''client'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''prd''', 'error');
select t.adv('owner cannot approve while the project is paused', t.proj('plan','paused')||';'||t.art('plan'), :'O', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error');
select t.adv('owner records their own soft approval', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'ok');
select t.adv('the same approval twice is refused', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error');
select t.adv('an approval dated in the past is stored as now', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'insert into approvals(artifact_id,approved_by,role,gate_type,at) select id,'''||:'O'||''',''owner'',''soft'',timestamptz ''2001-01-01'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'ok',
  '(select max(at) from approvals) > now()-interval ''1 minute''');
select t.adv('deleting a login keeps its approvals with the giver cleared', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client')||';delete from auth.users where id='''||:'C'||'''', :'O', 'authenticated', 'select 1', 'ok',
  '(select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id=''cccccccc-0000-0000-0000-000000000001'' and ap.approved_by is null)=1');
select t.adv('an owner cannot clear the giver of an approval by hand', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', 'update approvals set approved_by=null', 'error');
select t.adv('the worker cannot clear the giver of an approval by hand', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), null, 'service_role', 'update approvals set approved_by=null', 'error');
select t.adv('an approval whose login was deleted does not advance a stage', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client')||';delete from auth.users where id='''||:'C'||'''', :'O', 'authenticated', t.go('plan'), 'error:client approval');

\echo '### the named client signer (D-238)'
select t.adv('a second signer on one project is refused', t.proj('plan')||';insert into auth.users(id,email) values (''00000000-0000-0000-0000-0000000000c2'',''c2@x'')', :'O', 'authenticated', 'insert into clients(id,email,project_id,is_signer) values (''00000000-0000-0000-0000-0000000000c2'',''c2@x'',''cccccccc-0000-0000-0000-000000000001'',true)', 'error');
select t.adv('a second client login that is not the signer is fine', t.proj('plan')||';insert into auth.users(id,email) values (''00000000-0000-0000-0000-0000000000c2'',''c2@x'')', :'O', 'authenticated', 'insert into clients(id,email,project_id) values (''00000000-0000-0000-0000-0000000000c2'',''c2@x'',''cccccccc-0000-0000-0000-000000000001'')', 'ok');
select t.adv('a client who is not the signer cannot sign off the PRD', t.proj('requirements')||';'||t.art('prd')||';update artifacts set client_visible=true where project_id=''cccccccc-0000-0000-0000-000000000001'';update clients set is_signer=false where id=''00000000-0000-0000-0000-0000000000c1''', :'C', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'C'||''',''client'',''client'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''prd''', 'error');
select t.adv('the signer can sign off the PRD', t.proj('requirements')||';'||t.art('prd')||';update artifacts set client_visible=true where project_id=''cccccccc-0000-0000-0000-000000000001''', :'C', 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'C'||''',''client'',''client'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''prd''', 'ok');
select t.adv('a sign-off by a former signer no longer counts', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client')||';update clients set is_signer=false where id=''00000000-0000-0000-0000-0000000000c1''', :'O', 'authenticated', t.go('plan'), 'error:client approval');
select t.adv('a client cannot make themselves the signer', t.proj('plan')||';update clients set is_signer=false where id=''00000000-0000-0000-0000-0000000000c1''', :'C', 'authenticated', 'update clients set is_signer=true', 'ok', '(select count(*) from clients where id=''00000000-0000-0000-0000-0000000000c1'' and is_signer)=0');

\echo '### change-request freeze (D-238, D-239)'
select t.adv('client submits a change request before the freeze', t.proj('handover'), :'C', 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by) values (''cccccccc-0000-0000-0000-000000000001'',''x'',''client'','''||:'C'||''')', 'ok');
select t.adv('client cannot submit a change request after the freeze', t.proj('handover')||';update projects set changes_frozen_at=now()', :'C', 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by) values (''cccccccc-0000-0000-0000-000000000001'',''x'',''client'','''||:'C'||''')', 'error');

\echo '### artifacts never change after they are written; a guide is shown only after approval'
select t.adv('owner cannot rewrite an artifact''s content', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'update artifacts set content=''{"a":1}'' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error:immutable');
select t.adv('owner cannot change an artifact''s version', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'update artifacts set version=9 where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error:immutable');
select t.adv('the worker cannot rewrite an artifact''s content', t.proj('plan')||';'||t.art('plan'), null, 'service_role', 'update artifacts set content=''{"a":1}'' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error:immutable');
select t.adv('owner can still change an artifact''s status', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'update artifacts set status=''approved'' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'ok');
select t.adv('a handover guide cannot be made visible before the hard approval', t.proj('handover')||';'||t.art('handover_guide'), :'O', 'authenticated', 'update artifacts set client_visible=true where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error:hard approval');
select t.adv('a soft approval does not make the guide visible', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'soft'), :'O', 'authenticated', 'update artifacts set client_visible=true where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error:hard approval');
select t.adv('a handover guide can be made visible after the hard approval', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard'), :'O', 'authenticated', 'update artifacts set client_visible=true where project_id=''cccccccc-0000-0000-0000-000000000001''', 'ok');
select t.adv('a handover guide cannot be inserted already visible', t.proj('handover'), :'O', 'authenticated', 'insert into artifacts(project_id,type,client_visible) values (''cccccccc-0000-0000-0000-000000000001'',''handover_guide'',true)', 'error:hard approval');

\echo '### rows tied to their own project'
select t.run('an upload cannot point at another project''s files', :'O'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''11111111-1111-1111-1111-111111111111'',''asset'',''22222222-2222-2222-2222-222222222222/p'',''image/png'',1000)', 'error');
select t.run('an upload path must have the project folder', :'O'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',1000)', 'error');
select t.run('a comment cannot point at another project''s artifact', :'O'::uuid, 'authenticated', 'insert into comments(project_id,body,artifact_id) values (''11111111-1111-1111-1111-111111111111'',''x'',''bbbbbbb1-0000-0000-0000-000000000001'')', 'error');
select t.run('a comment can point at its own project''s artifact', :'O'::uuid, 'authenticated', 'insert into comments(project_id,body,artifact_id) values (''11111111-1111-1111-1111-111111111111'',''x'',''aaaaaaa1-0000-0000-0000-000000000003'')', 'ok:1');
select t.run('PRD feedback cannot point at another project''s artifact', :'O'::uuid, 'authenticated', 'insert into prd_feedback(project_id,artifact_id,body,created_by) values (''11111111-1111-1111-1111-111111111111'',''bbbbbbb1-0000-0000-0000-000000000001'',''x'','''||:'O'||''')', 'error');

\echo '### erase_project_data (retention job)'
create function t.closed_with_data(retention text) returns text language sql as $$
  select t.proj('closed','closed')
  || ';update project_internal set retention_until=' || retention || ' where project_id=''cccccccc-0000-0000-0000-000000000001'''
  || ';' || t.art('handover_guide',1,'approved','{"text":"secret"}') || ';' || t.art('plan') || ';' || t.appr('plan',1,'soft')
  || ';insert into uploads(project_id,kind,storage_path,mime_type,size_bytes) values (''cccccccc-0000-0000-0000-000000000001'',''asset'',''cccccccc-0000-0000-0000-000000000001/p'',''image/png'',10)'
  || ';insert into intake_rounds(project_id,round) values (''cccccccc-0000-0000-0000-000000000001'',1)'
  || ';insert into intake_responses(project_id,round,question_id,answer,asked_by) values (''cccccccc-0000-0000-0000-000000000001'',1,''q'',''"a"'',''template'')'
  || ';insert into stage_runs(id,project_id,stage) values (''ffffffff-0000-0000-0000-000000000001'',''cccccccc-0000-0000-0000-000000000001'',''intake'')'
  || ';insert into run_logs(run_id,message) values (''ffffffff-0000-0000-0000-000000000001'',''client name here'')'
  || ';insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''cccccccc-0000-0000-0000-000000000001'',''client'',''c@x'',''prd_ready'',''erase-test'')' $$;
select t.adv('erase: refused before the retention period ends', t.closed_with_data('now()+interval ''1 day'''), null, 'service_role', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'error:retention period');
select t.adv('erase: refused when no retention date is set', t.closed_with_data('null'), null, 'service_role', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'error:retention period');
select t.adv('erase: refused for an open project', t.proj('plan')||';update project_internal set retention_until=now()-interval ''1 day''', null, 'service_role', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'error:not closed');
select t.adv('erase: a client cannot call it', t.closed_with_data('now()-interval ''1 day'''), :'C', 'authenticated', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'error:not allowed');
select t.adv('erase: removes uploads, intake data, run logs and the guide text, keeps the audit trail', t.closed_with_data('now()-interval ''1 day'''), null, 'service_role', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'ok',
  '(select count(*) from uploads where project_id=''cccccccc-0000-0000-0000-000000000001'')=0
   and (select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'')=0
   and (select count(*) from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'')=0
   and (select count(*) from run_logs)=0
   and (select count(*) from email_log where project_id=''cccccccc-0000-0000-0000-000000000001'')=0
   and (select content::text from artifacts where type=''handover_guide'' and project_id=''cccccccc-0000-0000-0000-000000000001'')=''{}''
   and (select count(*) from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'')=2
   and (select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id=''cccccccc-0000-0000-0000-000000000001'')=1
   and (select data_deleted_at is not null from project_internal where project_id=''cccccccc-0000-0000-0000-000000000001'')');
select t.adv('erase: the owner can run it too', t.closed_with_data('now()-interval ''1 day'''), :'O', 'authenticated', 'select erase_project_data(''cccccccc-0000-0000-0000-000000000001'')', 'ok');
select t.adv('erase does not open the door to rewriting artifacts afterwards', t.closed_with_data('now()-interval ''1 day''')||';select set_config(''request.jwt.claim.role'',''service_role'',true);select erase_project_data(''cccccccc-0000-0000-0000-000000000001'');select set_config(''request.jwt.claim.role'','''',true)', :'O', 'authenticated', 'update artifacts set content=''{"x":1}'' where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error:immutable');


\echo '### typed artifacts, parked runs, change-request link, cancel reason'
select t.adv('an unknown artifact type is refused', t.proj('plan'), :'O', 'authenticated', 'insert into artifacts(project_id,type) values (''cccccccc-0000-0000-0000-000000000001'',''bogus'')', 'error');
select t.adv('a run can be parked and gets a parked time', t.proj('plan')||';insert into stage_runs(id,project_id,stage,status) values (''ffffffff-0000-0000-0000-000000000002'',''cccccccc-0000-0000-0000-000000000001'',''plan'',''running'')', null, 'service_role', 'update stage_runs set status=''parked'', parked_at=now() where id=''ffffffff-0000-0000-0000-000000000002''', 'ok', '(select parked_at is not null from stage_runs where id=''ffffffff-0000-0000-0000-000000000002'')');
select t.adv('a new artifact version can name a change request of its own project', t.proj('plan')||';insert into change_requests(id,project_id,description) values (''dddddddd-0000-0000-0000-000000000002'',''cccccccc-0000-0000-0000-000000000001'',''cr'')', :'O', 'authenticated', 'insert into artifacts(project_id,type,change_request_id) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',''dddddddd-0000-0000-0000-000000000002'')', 'ok');
select t.adv('an artifact cannot name another project''s change request', t.proj('plan')||';insert into change_requests(id,project_id,description) values (''dddddddd-0000-0000-0000-000000000003'',''11111111-1111-1111-1111-111111111111'',''cr'')', :'O', 'authenticated', 'insert into artifacts(project_id,type,change_request_id) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',''dddddddd-0000-0000-0000-000000000003'')', 'error');
select t.adv('a blank cancel reason is refused', t.proj('plan'), :'O', 'authenticated', 'update project_internal set cancel_reason=''   '' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'error');
select t.adv('a cancel reason can be stored', t.proj('plan'), :'O', 'authenticated', 'update project_internal set cancel_reason=''client left'' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'ok');
