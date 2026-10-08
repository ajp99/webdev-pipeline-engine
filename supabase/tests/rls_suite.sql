-- Row-level security and schema checks. Generated style: one t.run(...) line per check.
-- Each check prints PASS or FAIL. Run with supabase/tests/run.sh.
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

\echo '### stage intake: reads and project fields'
select t.run('client A reads only their own project', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from projects', 'ok:1');
select t.run('owner reads every project', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'select * from projects', 'ok:2');
select t.run('client A cannot read the other project', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from projects where id=''22222222-2222-2222-2222-222222222222''', 'ok:0');
select t.run('client A cannot read owner notes', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from owner_notes', 'ok:0');
select t.run('client A cannot change stage', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update projects set stage=''plan'' where id=''11111111-1111-1111-1111-111111111111''', 'ok:0');
select t.run('owner cannot change stage directly', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update projects set stage=''plan'' where id=''11111111-1111-1111-1111-111111111111''', 'error');
select t.run('owner sets token budget', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update projects set token_budget=2000000 where id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('client A cannot set token budget', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update projects set token_budget=1 where id=''11111111-1111-1111-1111-111111111111''', 'ok:0');
select t.run('owner sets data_deleted_at', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update projects set data_deleted_at=now() where id=''11111111-1111-1111-1111-111111111111''', 'ok:1');

\echo '### stage intake: answers, uploads and the open round'
select t.run('client A writes an answer in the open round', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into intake_responses(project_id,round,question_id,answer,asked_by) values (''11111111-1111-1111-1111-111111111111'',1,''q1'',''"x"'',''template'')', 'ok:1');
select t.run('client A cannot write to a round that does not exist', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into intake_responses(project_id,round,question_id,answer,asked_by) values (''11111111-1111-1111-1111-111111111111'',2,''q1'',''"x"'',''template'')', 'error');
select t.run('client A changes an earlier answer while a round is open', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update intake_responses set answer=''"y"'' where question_id=''q0''', 'ok:1');
select t.run('client A reads their answers', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from intake_responses', 'ok:1');
select t.run('upload image/png 1000 by client', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',1000,''pending'')', 'ok:1');
select t.run('upload image/png 1000 by client', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',1000,''clean'')', 'error');
select t.run('client A deletes an upload while the round is open', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'delete from uploads where id=''55555555-0000-0000-0000-000000000001''', 'ok:1');
select t.run('upload image/png 5242880 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',5242880,''pending'')', 'ok:1');
select t.run('upload image/jpeg 6291456 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/jpeg'',6291456,''pending'')', 'error');
select t.run('upload image/svg+xml 6291456 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/svg+xml'',6291456,''pending'')', 'error');
select t.run('upload application/pdf 20971520 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/pdf'',20971520,''pending'')', 'ok:1');
select t.run('upload application/pdf 27262976 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/pdf'',27262976,''pending'')', 'error');
select t.run('upload video/mp4 26214400 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''video/mp4'',26214400,''pending'')', 'ok:1');
select t.run('upload application/zip 1000 by owner', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''application/zip'',1000,''pending'')', 'error');
select t.run('client A submits the round', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update intake_rounds set status=''submitted'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
update intake_rounds set status='submitted' where project_id='11111111-1111-1111-1111-111111111111';
select t.run('upload image/png 1000 by client', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',1000,''pending'')', 'error');
select t.run('client A cannot delete an upload after submitting', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'delete from uploads where id=''55555555-0000-0000-0000-000000000001''', 'ok:0');
select t.run('client A reopens a submitted round', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update intake_rounds set status=''open'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
update intake_rounds set status='reviewed' where project_id='11111111-1111-1111-1111-111111111111';
select t.run('client A cannot reopen a reviewed round', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update intake_rounds set status=''open'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:0');
select t.run('client A cannot answer in a reviewed round', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into intake_responses(project_id,round,question_id,answer,asked_by) values (''11111111-1111-1111-1111-111111111111'',1,''q9'',''"x"'',''template'')', 'error');

\echo '### stage requirements: PRD sign-off and feedback'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='requirements' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A signs off the PRD', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'ok:1');
select t.run('client A cannot sign off a superseded PRD', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000002'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot approve a plan they cannot see', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000005'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot approve the prototype during requirements', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000003'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot approve as the owner role', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''owner'',''soft'')', 'error');
select t.run('client A cannot approve as someone else', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000b1'',''client'',''client'')', 'error');
select t.run('client A cannot approve the other project''s PRD', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''bbbbbbb1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A requests PRD changes', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into prd_feedback(project_id,artifact_id,body,created_by) values (''11111111-1111-1111-1111-111111111111'',''aaaaaaa1-0000-0000-0000-000000000001'',''b'',''00000000-0000-0000-0000-0000000000a1'')', 'ok:1');
select t.run('client A cannot attach feedback to a plan', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into prd_feedback(project_id,artifact_id,body,created_by) values (''11111111-1111-1111-1111-111111111111'',''aaaaaaa1-0000-0000-0000-000000000005'',''b'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
update projects set status='paused' where id='11111111-1111-1111-1111-111111111111';
select t.run('client A cannot sign off while paused', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot request PRD changes while paused', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into prd_feedback(project_id,artifact_id,body,created_by) values (''11111111-1111-1111-1111-111111111111'',''aaaaaaa1-0000-0000-0000-000000000001'',''b'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('client A can still read their project while paused', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from projects', 'ok:1');
update projects set status='active' where id='11111111-1111-1111-1111-111111111111';

\echo '### stage plan: nothing is open to the client'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='plan' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A cannot sign off the PRD at plan', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot request PRD changes at plan', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into prd_feedback(project_id,artifact_id,body,created_by) values (''11111111-1111-1111-1111-111111111111'',''aaaaaaa1-0000-0000-0000-000000000001'',''b'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('client cannot submit a change request before handover', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by) values (''11111111-1111-1111-1111-111111111111'',''x'',''client'',''00000000-0000-0000-0000-0000000000a1'')', 'error');

\echo '### stage prototype'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='prototype' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A approves the prototype', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000003'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'ok:1');
select t.run('client A cannot approve the PRD during prototype', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A adds a prototype note', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''prototype'',''00000000-0000-0000-0000-0000000000a1'')', 'ok:1');
select t.run('client A cannot add a final-screenshot note during prototype', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''final_screenshots'',''00000000-0000-0000-0000-0000000000a1'')', 'error');

\echo '### stage build_rounds: ask-client answers, runs and rounds'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='build_rounds' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A reads only ask-client backlog items', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from backlog_items', 'ok:1');
select t.run('client A answers an ask-client item', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set client_answer=''yes'' where ask_client', 'ok:1');
select t.run('client A cannot change owner_answer', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set owner_answer=''x'' where ask_client', 'error');
select t.run('client A cannot choose answer routing', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set answer_action=''next_round'' where ask_client', 'error');
select t.run('owner chooses answer routing', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update backlog_items set answer_action=''immediate_fix'' where ask_client', 'ok:1');
select t.run('client A cannot read stage runs', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from stage_runs', 'ok:0');
select t.run('a run can move to waiting', null, 'service_role', 'update stage_runs set status=''waiting''', 'ok:1');
select t.run('attempts above 2 rejected', null, 'service_role', 'update stage_runs set attempts=3', 'error');
select t.run('owner records a pause request', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''rewrite_history'',''git push --force'')', 'ok:1');
select t.run('pause request with an unknown kind rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''curl'',''curl x'')', 'error');
select t.run('client A cannot write pause requests', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''delete_files'',''rm -rf x'')', 'error');
select t.run('client A cannot read pause requests', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from run_approvals', 'ok:0');
select t.run('Feedback count above 3 rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update rounds set feedback_count=4', 'error');
select t.run('Feedback count of 3 allowed', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update rounds set feedback_count=3', 'ok:1');
select t.run('round claims stored', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update rounds set claims=''[{"id":"c1","text":"Open since 1998"}]''::jsonb', 'ok:1');
select t.run('client A cannot read rounds', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from rounds', 'ok:0');

\echo '### stage qc_report'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='qc_report' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A cannot answer ask-client items at qc_report', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set client_answer=''late'' where ask_client', 'ok:0');

\echo '### stage deploy_prep: final screenshots'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='deploy_prep' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A comments on the final screenshots', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''final_screenshots'',''00000000-0000-0000-0000-0000000000a1'')', 'ok:1');
select t.run('client A cannot add a prototype note at deploy_prep', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''prototype'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('client A cannot set owner_disposition on a note', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by,owner_disposition) values (''11111111-1111-1111-1111-111111111111'',''n'',''final_screenshots'',''00000000-0000-0000-0000-0000000000a1'',''ignored'')', 'error');

\echo '### stage handover: change requests, release notes and artifact visibility'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='handover' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A cannot add a final-screenshot note at handover', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''final_screenshots'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('client A submits a change request (status received)', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by) values (''11111111-1111-1111-1111-111111111111'',''x'',''client'',''00000000-0000-0000-0000-0000000000a1'')', 'ok:1');
select t.run('client cannot submit a request already marked accepted', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by,status) values (''11111111-1111-1111-1111-111111111111'',''x'',''client'',''00000000-0000-0000-0000-0000000000a1'',''accepted'')', 'error');
select t.run('client cannot submit a request with a decision', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by,decision) values (''11111111-1111-1111-1111-111111111111'',''x'',''client'',''00000000-0000-0000-0000-0000000000a1'',''defer'')', 'error');
select t.run('client A cannot change a request status', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update change_requests set status=''deployed''', 'ok:0');
select t.run('client A sees only their own project requests', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from change_requests', 'ok:1');
select t.run('client A can still answer ask-client items at handover', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set client_answer=''ok'' where ask_client', 'ok:1');
select t.run('owner records a mini-round decision and status', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set decision=''accept_mini_round'', status=''accepted'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('owner marks a request deployed', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set status=''deployed'' where project_id=''11111111-1111-1111-1111-111111111111''', 'ok:1');
select t.run('owner ties a mini-round to a request', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into rounds(project_id,number,branch,change_request_id) select project_id,2,''cr-1'',id from change_requests where project_id=''11111111-1111-1111-1111-111111111111'' limit 1', 'ok:1');
select t.run('status outside the enum rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'update change_requests set status=''shipped'' where project_id=''11111111-1111-1111-1111-111111111111''', 'error');
select t.run('owner approves a release note with a hard gate', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000006'',''00000000-0000-0000-0000-0000000000a0'',''owner'',''hard'')', 'ok:1');
select t.run('client A cannot approve a release note', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000006'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('client A cannot read the release note', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from artifacts where type=''release_note''', 'ok:0');
select t.run('client A reads only client-visible artifacts', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from artifacts', 'ok:4');

\echo '### closed project: read-only, handover guide only'
do $$ begin perform set_config('app.stage_advance','on',true); update projects set stage='closed', status='closed', close_reason='completed' where id='11111111-1111-1111-1111-111111111111'; end $$;
select t.run('client A still reads their project row', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from projects', 'ok:1');
select t.run('client A still reads their client row', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from clients', 'ok:1');
select t.run('client A reads only the handover guide', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from artifacts', 'ok:1');
select t.run('client A reads no intake_responses after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from intake_responses', 'ok:0');
select t.run('client A reads no uploads after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from uploads', 'ok:0');
select t.run('client A reads no comments after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from comments', 'ok:0');
select t.run('client A reads no change_requests after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from change_requests', 'ok:0');
select t.run('client A reads no backlog_items after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from backlog_items', 'ok:0');
select t.run('client A reads no prd_feedback after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from prd_feedback', 'ok:0');
select t.run('client A reads no intake_rounds after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from intake_rounds', 'ok:0');
select t.run('client A reads no approvals after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from approvals', 'ok:0');
select t.run('client A cannot submit a change request after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into change_requests(project_id,description,submitted_by,created_by) values (''11111111-1111-1111-1111-111111111111'',''x'',''client'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('client A cannot add a note after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into comments(project_id,body,kind,created_by) values (''11111111-1111-1111-1111-111111111111'',''n'',''final_screenshots'',''00000000-0000-0000-0000-0000000000a1'')', 'error');
select t.run('upload image/png 1000 by client', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into uploads(project_id,kind,storage_path,mime_type,size_bytes,scan_status) values (''11111111-1111-1111-1111-111111111111'',''asset'',''p'',''image/png'',1000,''pending'')', 'error');
select t.run('client A cannot delete an upload after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'delete from uploads where id=''55555555-0000-0000-0000-000000000001''', 'ok:0');
select t.run('client A cannot answer ask-client items after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'update backlog_items set client_answer=''z'' where ask_client', 'ok:0');
select t.run('client A cannot sign off after close', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into approvals(artifact_id,approved_by,role,gate_type) values (''aaaaaaa1-0000-0000-0000-000000000001'',''00000000-0000-0000-0000-0000000000a1'',''client'',''client'')', 'error');
select t.run('owner still reads everything after close', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'select * from comments', 'ok:1');

\echo '### email log'
insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values ('11111111-1111-1111-1111-111111111111','client','a@x','prd_ready','fixture-key');
select t.run('owner records an email', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k1'')', 'ok:1');
select t.run('a duplicate dedupe key is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''fixture-key'')', 'error');
select t.run('the same key twice in one statement is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k2''),(''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k2'')', 'error');
select t.run('an unknown event is rejected', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''newsletter'',''k3'')', 'error');
select t.run('an owner alert without a project is allowed', '00000000-0000-0000-0000-0000000000a0'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (null,''owner'',''r@x'',''gate_ready'',''k4'')', 'ok:1');
select t.run('the worker marks an email sent', null, 'service_role', 'update email_log set sent_at=now()', 'ok:1');
select t.run('client A cannot read the email log', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from email_log', 'ok:0');
select t.run('client A cannot write to the email log', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''k5'')', 'error');

\echo '### schema facts'

select 'PASS      23 tables' where (select count(*) from information_schema.tables where table_schema='public')=23
union all select 'FAIL      table count is ' || (select count(*) from information_schema.tables where table_schema='public') where (select count(*) from information_schema.tables where table_schema='public')<>23
union all select 'PASS      stage_runs.cost removed' where not exists (select 1 from information_schema.columns where table_name='stage_runs' and column_name='cost')
union all select 'PASS      token_budget replaces cost_warn_threshold' where not exists (select 1 from information_schema.columns where table_name='projects' and column_name='cost_warn_threshold') and exists (select 1 from information_schema.columns where table_name='projects' and column_name='token_budget')
union all select 'PASS      9 gate defaults' where (select count(*) from gate_config where project_id is null)=9
union all select 'PASS      row-level security on every table' where not exists (select 1 from pg_tables where schemaname='public' and not rowsecurity)
union all select 'PASS      enum ' || x.name from (values
    ('change_status', array['received','accepted','deferred','declined','deployed']),
    ('change_decision', array['accept_current_round','accept_mini_round','defer','decline']),
    ('run_status', array['queued','running','waiting','succeeded','failed','cancelled']),
    ('comment_kind', array['prototype','final_screenshots']),
    ('answer_action', array['next_round','immediate_fix']),
    ('run_approval_status', array['pending','approved','denied'])
  ) as x(name, labels)
  where (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname=x.name) = x.labels::text[];

