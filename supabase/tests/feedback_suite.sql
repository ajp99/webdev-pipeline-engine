-- Gate feedback (P2-T19, D-234, D-133, D-120): feedback_gate, the gate_feedback table, the loop caps in
-- gate_config and the feedback columns of remaining_gates. Loaded after gates_suite.sql, which defines t.rg, t.is_stage,
-- t.art_status and t.agent_on (and, before it, t.proj, t.art, t.rs, t.rnd, t.acc, t.rej).
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set CP 'cccccccc-0000-0000-0000-000000000001'

-- feedback_gate on the scratch project's newest artifact of a type.
create function t.fb(typ text, body text default 'make it shorter', rnd int default null) returns text language sql as
$$ select format('select feedback_gate(%L, (select id from artifacts where project_id=%L and type=%L order by version desc limit 1), %L, %s)',
  'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', typ, body, coalesce(rnd::text, 'null')) $$;
-- The call above, also checking what it returns.
create function t.fbr(typ text, expect int, rnd int default null) returns text language sql as
$$ select format('select case when (%s) = %s then 1 else t.fail() end', t.fb(typ, 'notes', rnd), expect) $$;
-- n earlier Feedback rows on the newest artifact of a type (setup runs as the database owner).
create function t.fbrows(typ text, n int, rnd int default null) returns text language sql as
$$ select format('insert into gate_feedback(project_id,artifact_id,round,body,created_by) select %L, a.id, %s, ''earlier'', %L
   from (select id from artifacts where project_id=%L and type=%L order by version desc limit 1) a, generate_series(1,%s)',
  'cccccccc-0000-0000-0000-000000000001', coalesce(rnd::text, 'null'), '00000000-0000-0000-0000-0000000000a0',
  'cccccccc-0000-0000-0000-000000000001', typ, n) $$;
create function t.fbcount(n int) returns text language sql as
$$ select format('(select count(*) from gate_feedback where project_id=%L)=%s', 'cccccccc-0000-0000-0000-000000000001', n) $$;
create function t.runs(n int, st text default 'queued') returns text language sql as
$$ select format('(select count(*) from stage_runs where project_id=%L and status=%L)=%s', 'cccccccc-0000-0000-0000-000000000001', st, n) $$;

\echo '### who can give feedback'
select t.adv('feedback: a non-owner is refused', t.proj('plan')||';'||t.art('plan'), :'A', 'authenticated', t.fb('plan'), 'error:feedback_gate: not allowed');
select t.adv('feedback: the worker is refused', t.proj('plan')||';'||t.art('plan'), null, 'service_role', t.fb('plan'), 'error');
select t.adv('feedback: the anon role is refused', t.proj('plan')||';'||t.art('plan'), null, 'anon', t.fb('plan'), 'error');
select t.adv('the owner cannot write a feedback row directly', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'insert into gate_feedback(project_id,artifact_id,body,created_by) select project_id,id,''x'','''||:'O'||''' from artifacts where type=''plan'' and project_id='''||:'CP'||'''', 'error:permission denied for table gate_feedback');
select t.adv('the worker cannot write a feedback row directly', t.proj('plan')||';'||t.art('plan'), null, 'service_role',
  'insert into gate_feedback(project_id,artifact_id,body,created_by) select project_id,id,''x'','''||:'O'||''' from artifacts where type=''plan'' and project_id='''||:'CP'||'''', 'error:permission denied for table gate_feedback');
select t.adv('the owner cannot change a feedback row', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), :'O', 'authenticated',
  'update gate_feedback set body=''changed'' where project_id='''||:'CP'||'''', 'error:permission denied for table gate_feedback');
select t.adv('the owner cannot delete a feedback row', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), :'O', 'authenticated',
  'delete from gate_feedback where project_id='''||:'CP'||'''', 'error:permission denied for table gate_feedback');
select t.adv('feedback rows are append-only even for the database owner', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), null, current_user,
  'update gate_feedback set body=''changed'' where project_id='''||:'CP'||'''', 'error:append-only');
select t.adv('feedback rows cannot be deleted even by the database owner', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), null, current_user,
  'delete from gate_feedback where project_id='''||:'CP'||'''', 'error:append-only');
select t.adv('the owner reads feedback rows', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',2), :'O', 'authenticated',
  'select case when (select count(*) from gate_feedback where project_id='''||:'CP'||''')=2 then 1 else t.fail() end', 'ok');
select t.adv('another signed-in user reads no feedback rows', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',2), :'A', 'authenticated',
  'select case when (select count(*) from gate_feedback)=0 then 1 else t.fail() end', 'ok');

\echo '### what feedback does'
select t.adv('feedback on a drafted plan records the notes and returns 1', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fbr('plan',1), 'ok',
  t.fbcount(1)||' and (select body=''notes'' and created_by='''||:'O'||''' and round is null from gate_feedback where project_id='''||:'CP'||''')');
select t.adv('feedback keeps the version a draft and the stage open', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan'), 'ok',
  t.art_status('plan',1,'draft')||' and '||t.is_stage('plan'));
select t.adv('feedback trims the notes', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan','  tidy  '), 'ok',
  '(select body=''tidy'' from gate_feedback where project_id='''||:'CP'||''')');
select t.adv('feedback can be sent twice on one version (each is a loop)', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), :'O', 'authenticated', t.fbr('plan',2), 'ok', t.fbcount(2));
select t.adv('blank feedback is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan','   '), 'error:write the feedback first');
select t.adv('missing feedback is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan',null), 'error:write the feedback first');
select t.adv('feedback over 10000 characters is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan',repeat('x',10001)), 'error:gate_feedback_body');
select t.adv('feedback of exactly 10000 characters is kept', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan',repeat('x',10000)), 'ok', t.fbcount(1));
select t.adv('a paused project gets no feedback', t.proj('plan','paused')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan'), 'error:only an active project');
select t.adv('an unknown project gets no feedback', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'select feedback_gate(''dddddddd-0000-0000-0000-000000000001'', (select id from artifacts where type=''plan'' and project_id='''||:'CP'||'''), ''x'')', 'error:project not found');
select t.adv('feedback on an older version is refused', t.proj('plan')||';'||t.art('plan',1,'superseded')||';'||t.art('plan',2), :'O', 'authenticated',
  'select feedback_gate('''||:'CP'||''', (select id from artifacts where type=''plan'' and version=1 and project_id='''||:'CP'||'''), ''x'')', 'error:not the newest version');
select t.adv('feedback on an approved version is refused', t.proj('plan')||';'||t.art('plan',1,'approved'), :'O', 'authenticated', t.fb('plan'), 'error:that version is already approved');
select t.adv('feedback on a rejected version is refused (drafts only)', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.fb('plan'), 'error:that version is already rejected');
select t.adv('accept still refuses a rejected version', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.acc('plan'), 'error:that version is already rejected');
select t.adv('reject still refuses a rejected version', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.rej('plan'), 'error:that version is already rejected');
select t.adv('feedback on another project''s artifact is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'select feedback_gate('''||:'CP'||''', ''aaaaaaa1-0000-0000-0000-000000000005'', ''x'')', 'error:does not belong to this project');
select t.adv('feedback on an artifact of another stage is refused', t.proj('plan')||';'||t.art('plan')||';'||t.art('prd'), :'O', 'authenticated', t.fb('prd'), 'error:gated by a plan artifact');
select t.adv('a round number outside build rounds is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan','x',1), 'error:only build rounds');
select t.adv('feedback while the owner gate is approved and the client gate waits is allowed', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft'), :'O', 'authenticated', t.fb('prototype'), 'ok', t.fbcount(1));

\echo '### loop caps (spec 03: 3 on intake, PRD, plan, deploy prep, handover; 2 prototype and QC; 3 per round)'
select t.adv('plan: the third loop is allowed', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',2), :'O', 'authenticated', t.fbr('plan',3), 'ok');
select t.adv('plan: a fourth loop is refused', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3), :'O', 'authenticated', t.fb('plan'), 'error:the 3 feedback loops on this plan are used up');
select t.adv('the cap counts loops on earlier versions too', t.proj('plan')||';'||t.art('plan',1,'superseded')||';'||t.fbrows('plan',3)||';'||t.art('plan',2), :'O', 'authenticated', t.fb('plan'), 'error:used up');
select t.adv('a refused loop writes nothing', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3), :'O', 'authenticated',
  'do $x$ begin begin perform feedback_gate('''||:'CP'||''',(select id from artifacts where type=''plan'' and project_id='''||:'CP'||'''),''x''); exception when others then null; end; end $x$', 'ok', t.fbcount(3));
select t.adv('loops on another type do not count', t.proj('plan')||';'||t.art('prd',1,'approved')||';'||t.fbrows('prd',3)||';'||t.art('plan'), :'O', 'authenticated', t.fbr('plan',1), 'ok');
select t.adv('loops in another project do not count', t.proj('plan')||';'||t.art('plan')||';insert into gate_feedback(project_id,artifact_id,body,created_by) select ''11111111-1111-1111-1111-111111111111'',''aaaaaaa1-0000-0000-0000-000000000005'',''other'','''||:'O'||''' from generate_series(1,3)', :'O', 'authenticated', t.fbr('plan',1), 'ok');
select t.adv('prototype: the second loop is allowed', t.proj('prototype')||';'||t.art('prototype')||';'||t.fbrows('prototype',1), :'O', 'authenticated', t.fbr('prototype',2), 'ok');
select t.adv('prototype: a third loop is refused (D-120)', t.proj('prototype')||';'||t.art('prototype')||';'||t.fbrows('prototype',2), :'O', 'authenticated', t.fb('prototype'), 'error:the 2 feedback loops');
select t.adv('QC report: a third loop is refused', t.proj('qc_report')||';'||t.art('report')||';'||t.fbrows('report',2), :'O', 'authenticated', t.fb('report'), 'error:the 2 feedback loops');
select t.adv('QC report: the second loop is allowed', t.proj('qc_report')||';'||t.art('report')||';'||t.fbrows('report',1), :'O', 'authenticated', t.fbr('report',2), 'ok');
select t.adv('intake: a fourth loop is refused', t.proj('intake')||';'||t.art('intake_record')||';'||t.fbrows('intake_record',3), :'O', 'authenticated', t.fb('intake_record'), 'error:the 3 feedback loops');
select t.adv('intake: the third loop is allowed', t.proj('intake')||';'||t.art('intake_record')||';'||t.fbrows('intake_record',2), :'O', 'authenticated', t.fbr('intake_record',3), 'ok');
select t.adv('PRD: a fourth loop is refused', t.proj('requirements')||';'||t.art('prd')||';'||t.fbrows('prd',3), :'O', 'authenticated', t.fb('prd'), 'error:the 3 feedback loops');
select t.adv('PRD: the third loop is allowed', t.proj('requirements')||';'||t.art('prd')||';'||t.fbrows('prd',2), :'O', 'authenticated', t.fbr('prd',3), 'ok');
select t.adv('deploy prep: a fourth loop is refused', t.proj('deploy_prep')||';'||t.art('deployment_checklist')||';'||t.fbrows('deployment_checklist',3), :'O', 'authenticated', t.fb('deployment_checklist'), 'error:the 3 feedback loops');
select t.adv('deploy prep: the third loop is allowed', t.proj('deploy_prep')||';'||t.art('deployment_checklist')||';'||t.fbrows('deployment_checklist',2), :'O', 'authenticated', t.fbr('deployment_checklist',3), 'ok');
select t.adv('handover: a fourth loop is refused', t.proj('handover')||';'||t.art('handover_guide')||';'||t.fbrows('handover_guide',3), :'O', 'authenticated', t.fb('handover_guide'), 'error:the 3 feedback loops');
select t.adv('handover: the third loop is allowed', t.proj('handover')||';'||t.art('handover_guide')||';'||t.fbrows('handover_guide',2), :'O', 'authenticated', t.fbr('handover_guide',3), 'ok');
select t.adv('after the cap Accept is still possible', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3), :'O', 'authenticated', t.acc('plan'), 'ok', t.is_stage('prototype'));
select t.adv('after the cap Reject is still possible', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3), :'O', 'authenticated', t.rej('plan'), 'ok', t.art_status('plan',1,'rejected'));

\echo '### build rounds (D-133)'
select t.adv('round: feedback on a round in review counts on the round', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated', t.fbr('round_summary',1,1), 'ok',
  '(select round from gate_feedback where project_id='''||:'CP'||''')=1');
select t.adv('round: feedback needs the round named', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated', t.fb('round_summary'), 'error:name the build round');
select t.adv('round: a round not in review gets no feedback', t.proj('build_rounds')||';'||t.rnd(1,'building')||';'||t.rs(1), :'O', 'authenticated', t.fb('round_summary','x',1), 'error:feedback_gate: round 1 is not in review');
select t.adv('round: a fourth loop on a round is refused', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';'||t.fbrows('round_summary',3,1), :'O', 'authenticated', t.fb('round_summary','x',1), 'error:the 3 feedback loops');
select t.adv('round: the third loop on a round is allowed', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';'||t.fbrows('round_summary',2,1), :'O', 'authenticated', t.fbr('round_summary',3,1), 'ok');
select t.adv('round: loops on another round do not count', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.rs(1,1,'approved')||';'||t.fbrows('round_summary',3,1)||';'||t.rnd(2,'in_review')||';'||t.rs(2,2), :'O', 'authenticated', t.fbr('round_summary',1,2), 'ok');

\echo '### runs'
select t.adv('without an agent for the stage feedback queues no run', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.fb('plan'), 'ok', t.runs(0));
select t.adv('with an agent for the stage feedback queues a run for the stage', t.proj('plan')||';'||t.art('plan')||';'||t.agent_on(), :'O', 'authenticated', t.fb('plan'), 'ok',
  t.runs(1)||' and (select stage::text from stage_runs where project_id='''||:'CP'||''')=''plan''');
select t.adv('a run already queued is not doubled', t.proj('plan')||';'||t.art('plan')||';'||t.agent_on()||';insert into stage_runs(project_id,stage) values ('''||:'CP'||''',''plan'')', :'O', 'authenticated', t.fb('plan'), 'ok', t.runs(1)||' and '||t.fbcount(1));
select t.adv('if the run cannot be queued the feedback is undone', t.proj('plan')||';'||t.art('plan')||';'||t.agent_on()||';create or replace function public.enqueue_run(p_project uuid, p_stage public.stage) returns uuid language plpgsql as $f$ begin raise exception ''enqueue broken''; end $f$', :'O', 'authenticated',
  'do $x$ begin begin perform feedback_gate('''||:'CP'||''',(select id from artifacts where type=''plan'' and project_id='''||:'CP'||'''),''x''); exception when others then null; end; end $x$', 'ok', t.fbcount(0));

\echo '### remaining_gates feedback columns'
select t.adv('remaining_gates shows the loops used and the cap', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',2), :'O', 'authenticated',
  t.rg('r.feedback_used=2 and r.feedback_cap=3 and r.state=''missing'''), 'ok');
select t.adv('remaining_gates: no feedback yet is 0', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.rg('r.feedback_used=0'), 'ok');
select t.adv('remaining_gates: a rejected newest version waits, unnamed, with its loops', t.proj('plan')||';'||t.art('plan',1,'rejected')||';'||t.fbrows('plan',1), :'O', 'authenticated',
  t.rg('r.state=''waiting'' and r.artifact_id is null and r.feedback_used=1 and r.feedback_cap=3'), 'ok');
select t.adv('remaining_gates: the prototype cap is 2', t.proj('prototype')||';'||t.art('prototype'), :'O', 'authenticated', t.rg('r.feedback_cap=2', 2), 'ok');
select t.adv('remaining_gates: rounds count per round', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';'||t.fbrows('round_summary',2,1)||';'||t.rnd(2,'in_review')||';'||t.rs(2,2), :'O', 'authenticated',
  t.rg('(r.round=1 and r.feedback_used=2 and r.feedback_cap=3) or (r.round=2 and r.feedback_used=0)', 2), 'ok');
select t.adv('remaining_gates: a round waiting for its summary still shows its loops', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1,1,'rejected')||';'||t.fbrows('round_summary',1,1), :'O', 'authenticated',
  t.rg('r.round=1 and r.state=''waiting'' and r.feedback_used=1 and r.feedback_cap=3 and r.artifact_id is null'), 'ok');
select t.adv('round: feedback on a rejected summary is refused', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1,1,'rejected'), :'O', 'authenticated', t.fb('round_summary','x',1), 'error:that version is already rejected');

\echo '### review fixes (P2-T19)'
select t.adv('the owner cannot truncate feedback rows', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), :'O', 'authenticated', 'truncate gate_feedback', 'error:permission denied for table gate_feedback');
select t.adv('the worker cannot truncate feedback rows', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1), null, 'service_role', 'truncate gate_feedback', 'error:permission denied for table gate_feedback');
select t.adv('the owner cannot truncate approvals', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', 'truncate approvals', 'error:permission denied for table approvals');
select t.adv('the worker cannot truncate approvals', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), null, 'service_role', 'truncate approvals', 'error:permission denied for table approvals');
select t.adv('the worker reads feedback rows to give them to the agent', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',2), null, 'service_role',
  'select case when (select count(*) from gate_feedback where project_id='''||:'CP'||''')=2 then 1 else t.fail() end', 'ok');

\echo '### caps in gate_config (owner decision 2026-10-28)'
select t.adv('a project row can lower the cap', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1)||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',1)', :'O', 'authenticated', t.fb('plan'), 'error:the 1 feedback loops');
select t.adv('a project row can raise the cap', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3)||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',5)', :'O', 'authenticated', t.fbr('plan',4), 'ok');
select t.adv('a project row with no cap keeps the default', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',3)||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'','''||:'CP'||''',''hard'',''owner'')', :'O', 'authenticated', t.fb('plan'), 'error:the 3 feedback loops');
select t.adv('another project''s cap does not apply', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1)||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'',''11111111-1111-1111-1111-111111111111'',''soft'',''owner'',1)', :'O', 'authenticated', t.fbr('plan',2), 'ok');
select t.adv('another stage''s cap does not apply', t.proj('plan')||';'||t.art('plan')||';'||t.fbrows('plan',1)||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''intake'','''||:'CP'||''',''soft'',''owner'',1)', :'O', 'authenticated', t.fbr('plan',2), 'ok');
select t.adv('a cap of 0 turns Feedback off for the stage', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',0)', :'O', 'authenticated', t.fb('plan'), 'error:stage plan takes no feedback');
select t.adv('remaining_gates shows a project''s own cap', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',5)', :'O', 'authenticated', t.rg('r.feedback_cap=5'), 'ok');
select t.adv('the owner cannot change a global cap', t.proj('plan'), :'O', 'authenticated', 'update gate_config set feedback_cap=5 where stage=''plan'' and project_id is null', 'error:a global Feedback cap changes only through a migration');
select t.adv('the owner can change a project row''s cap', t.proj('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',1)', :'O', 'authenticated',
  'update gate_config set feedback_cap=2 where stage=''plan'' and project_id='''||:'CP'||'''', 'ok', '(select feedback_cap from gate_config where stage=''plan'' and project_id='''||:'CP'||''')=2');
select t.adv('the owner can still change a global deadline', t.proj('plan'), :'O', 'authenticated', 'update gate_config set escalate_after_hours=48 where stage=''plan'' and project_id is null', 'ok');
select t.adv('a cap above 10 is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'insert into gate_config(stage,project_id,gate_type,gatekeeper,feedback_cap) values (''plan'','''||:'CP'||''',''soft'',''owner'',11)', 'error:feedback_cap');
select t.adv('the seed caps follow spec 03 (first gate row; none on the prototype client row)', t.proj('plan'), :'O', 'authenticated',
  'select case when (select string_agg(stage||''/''||gate_type||''=''||coalesce(feedback_cap::text,''-''), '','' order by stage, gate_type) from gate_config where project_id is null)
   = ''intake/soft=3,requirements/client=3,plan/soft=3,prototype/soft=2,prototype/client=-,build_rounds/soft=3,qc_report/soft=2,deploy_prep/hard=3,handover/hard=3'' then 1 else t.fail() end', 'ok');
