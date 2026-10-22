-- Gate functions (P2-T18, D-239, D-258, D-261, D-318, D-259): remaining_gates, accept_gate, reject_gate,
-- the intake rule and the artifact version block. Loaded after intake_review_suite.sql, which defines
-- t.ir (an intake round) and the helpers t.proj, t.art, t.appr, t.rnd, t.rs, t.acc, t.rej, t.go.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set CP 'cccccccc-0000-0000-0000-000000000001'

create function t.fail() returns int language plpgsql as $$ begin raise exception 'assertion failed'; end $$;
-- The call: remaining_gates for the scratch project returns exactly n rows matching cond (else 1/0).
create function t.rg(cond text, n int default 1) returns text language sql as
$$ select format('select case when (select count(*) from remaining_gates(%L) r where %s) = %s then 1 else t.fail() end',
  'cccccccc-0000-0000-0000-000000000001', cond, n) $$;
create function t.stg() returns text language sql as
$$ select 'select stage::text from projects where id=''cccccccc-0000-0000-0000-000000000001''' $$;
-- Checks run after a successful call.
create function t.is_stage(s text) returns text language sql as
$$ select format('(select stage::text from projects where id=%L)=%L', 'cccccccc-0000-0000-0000-000000000001', s) $$;
create function t.art_status(typ text, ver int, st text) returns text language sql as
$$ select format('(select status::text from artifacts where project_id=%L and type=%L and version=%s)=%L', 'cccccccc-0000-0000-0000-000000000001', typ, ver, st) $$;
-- Makes the requirements stage a stage with an agent, so accept_gate queues a run when it enters it.
create function t.agent_on() returns text language sql as
$$ select 'create or replace function private.stage_has_agent(p_stage public.stage) returns boolean language sql immutable set search_path = '''' as $f$ select true $f$' $$;

\echo '### remaining_gates (D-261)'
select t.adv('remaining_gates: a non-owner is refused', t.proj('plan')||';'||t.art('plan'), :'A', 'authenticated', t.rg('true'), 'error:not allowed');
select t.adv('remaining_gates: the anon role is refused', t.proj('plan')||';'||t.art('plan'), null, 'anon', t.rg('true'), 'error');
select t.adv('remaining_gates: the worker is refused', t.proj('plan')||';'||t.art('plan'), null, 'service_role', t.rg('true'), 'error');
select t.adv('a drafted plan has one missing owner gate', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  t.rg('r.stage=''plan'' and r.gate_type=''soft'' and r.gatekeeper=''owner'' and r.state=''missing'' and r.artifact_version=1 and r.artifact_type=''plan'' and r.round is null and not r.ready_to_advance and not r.overdue'), 'ok');
select t.adv('no current artifact: the gates wait for the agent', t.proj('plan'), :'O', 'authenticated', t.rg('r.state=''waiting'' and r.artifact_id is null and r.since is null and not r.ready_to_advance'), 'ok');
select t.adv('a superseded newest artifact waits for the agent', t.proj('plan')||';'||t.art('plan',1,'superseded'), :'O', 'authenticated', t.rg('r.state=''waiting''', 1), 'ok');
select t.adv('a rejected newest artifact waits for the agent', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.rg('r.state=''waiting''', 1), 'ok');
select t.adv('the newest version counts, not the first', t.proj('plan')||';'||t.art('plan',1,'superseded')||';'||t.art('plan',2), :'O', 'authenticated', t.rg('r.state=''missing'' and r.artifact_version=2'), 'ok');
select t.adv('prototype: the owner gate is missing and the client gate is blocked behind it', t.proj('prototype')||';'||t.art('prototype'), :'O', 'authenticated',
  t.rg('(r.gate_type=''soft'' and r.state=''missing'') or (r.gate_type=''client'' and r.gatekeeper=''client'' and r.state=''blocked'')', 2), 'ok');
select t.adv('prototype: after the owner approves, the client gate is the one missing', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft'), :'O', 'authenticated',
  t.rg('(r.gate_type=''soft'' and r.state=''satisfied'') or (r.gate_type=''client'' and r.state=''missing'')', 2), 'ok');
select t.adv('all gates approved: every row is satisfied and the project is ready to advance', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated',
  t.rg('r.state=''satisfied'' and r.ready_to_advance and not r.overdue'), 'ok');
select t.adv('an approval by a giver who is no longer an owner does not count', t.proj('plan')||';'||t.art('plan')||';insert into auth.users(id,email) values (''00000000-0000-0000-0000-0000000000d1'',''d@x'');insert into owners(id) values (''00000000-0000-0000-0000-0000000000d1'');'||t.appr('plan',1,'soft',0,'00000000-0000-0000-0000-0000000000d1')||';delete from owners where id=''00000000-0000-0000-0000-0000000000d1''', :'O', 'authenticated',
  t.rg('r.state=''missing'' and not r.ready_to_advance'), 'ok');
select t.adv('an approval in the wrong role does not satisfy the gate', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client')||';alter table gate_config drop constraint gatekeeper_matches_gate;update gate_config set gatekeeper=''owner'' where stage=''requirements'' and project_id is null', :'O', 'authenticated',
  t.rg('r.gate_type=''client'' and r.state=''missing'''), 'ok');
select t.adv('a paused project is not listed', t.proj('plan','paused')||';'||t.art('plan'), :'O', 'authenticated', t.rg('true', 0), 'ok');
select t.adv('a closed project is not listed', t.proj('closed','closed'), :'O', 'authenticated', t.rg('true', 0), 'ok');
select t.adv('without a filter every active project is listed', t.proj('plan')||';'||t.art('plan')||';insert into projects(id,name,stage) values (''cccccccc-0000-0000-0000-000000000002'',''D'',''plan'')', :'O', 'authenticated',
  'select case when (select count(distinct project_id) from remaining_gates()) >= 2 and (select count(distinct project_id) from remaining_gates(''cccccccc-0000-0000-0000-000000000002'')) = 1 then 1 else t.fail() end', 'ok');
select t.adv('a gate waiting longer than its deadline is overdue', t.proj('plan')||';insert into artifacts(project_id,type,version,created_at) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',1,now()-interval ''48 hours'')', :'O', 'authenticated',
  t.rg('r.state=''missing'' and r.overdue and r.due_at < now()'), 'ok');
select t.adv('a gate inside its deadline is not overdue', t.proj('plan')||';insert into artifacts(project_id,type,version,created_at) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',1,now()-interval ''2 hours'')', :'O', 'authenticated',
  t.rg('r.state=''missing'' and not r.overdue and r.due_at > now()'), 'ok');
select t.adv('the deadline is the gate''s own: a project row can shorten it', t.proj('plan')||';insert into artifacts(project_id,type,version,created_at) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',1,now()-interval ''2 hours'');insert into gate_config(stage,project_id,gate_type,gatekeeper,escalate_after_hours) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''soft'',''owner'',1)', :'O', 'authenticated',
  t.rg('r.state=''missing'' and r.overdue'), 'ok');
select t.adv('a satisfied gate is never overdue', t.proj('plan')||';insert into artifacts(project_id,type,version,created_at) values (''cccccccc-0000-0000-0000-000000000001'',''plan'',1,now()-interval ''48 hours'');'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.rg('r.state=''satisfied'' and not r.overdue'), 'ok');
select t.adv('the next gate starts waiting when the earlier one was approved', t.proj('prototype')||';insert into artifacts(project_id,type,version,created_at) values (''cccccccc-0000-0000-0000-000000000001'',''prototype'',1,timestamptz ''2026-01-01 09:00'');'||t.appr('prototype',1,'soft',0), :'O', 'authenticated',
  t.rg('r.gate_type=''client'' and r.since = timestamptz ''2026-01-01 10:00'' + interval ''0 minutes'' and r.due_at = r.since + interval ''24 hours'''), 'ok');
select t.adv('a project-added hard gate joins the plan gates', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated',
  t.rg('(r.gate_type=''soft'' and r.state=''missing'') or (r.gate_type=''hard'' and r.state=''blocked'')', 2), 'ok');
select t.adv('intake: approved but the latest round is open, so not ready to advance (D-318)', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft')||';'||t.ir(1,'reviewed')||';'||t.ir(2,'open'), :'O', 'authenticated',
  t.rg('r.state=''satisfied'' and not r.ready_to_advance'), 'ok');
select t.adv('intake: approved with the latest round reviewed is ready to advance', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft')||';'||t.ir(1,'reviewed'), :'O', 'authenticated',
  t.rg('r.state=''satisfied'' and r.ready_to_advance'), 'ok');
select t.adv('build rounds: a round in review shows its newest summary', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1,1,'superseded')||';'||t.rs(1,2), :'O', 'authenticated',
  t.rg('r.round=1 and r.state=''missing'' and r.artifact_type=''round_summary'' and r.artifact_version=2 and r.gate_type=''soft'''), 'ok');
select t.adv('build rounds: a round in review with no summary waits for the agent', t.proj('build_rounds')||';'||t.rnd(1,'in_review'), :'O', 'authenticated',
  t.rg('r.round=1 and r.state=''waiting'' and r.artifact_id is null'), 'ok');
select t.adv('build rounds: one row per round in review, none for rounds still being built', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rnd(2,'building')||';'||t.rnd(3,'in_review')||';'||t.rs(1)||';'||t.rs(3,2), :'O', 'authenticated',
  t.rg('r.round in (1,3) and r.state=''missing''', 2), 'ok');
select t.adv('build rounds: nothing in review and not all approved waits for the agent', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.rnd(2,'building'), :'O', 'authenticated',
  t.rg('r.round is null and r.state=''waiting'' and not r.ready_to_advance'), 'ok');
select t.adv('build rounds: all rounds approved is ready to advance', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.rs(1,1,'approved')||';'||t.appr('round_summary',1,'soft'), :'O', 'authenticated',
  t.rg('r.round is null and r.state=''satisfied'' and r.ready_to_advance'), 'ok');

\echo '### accept_gate (D-258)'
select t.adv('accept_gate: a non-owner is refused', t.proj('plan')||';'||t.art('plan'), :'A', 'authenticated', t.acc('plan'), 'error:not allowed');
select t.adv('accept_gate: the anon role is refused', t.proj('plan')||';'||t.art('plan'), null, 'anon', t.acc('plan'), 'error');
select t.adv('accept_gate: the worker is refused (D-264)', t.proj('plan')||';'||t.art('plan'), null, 'service_role', t.acc('plan'), 'error');
select t.adv('accepting the last owner gate advances the project and approves the artifact', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.acc('plan'), 'ok',
  t.is_stage('prototype')||' and '||t.art_status('plan',1,'approved')||' and (select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'CP'||''' and ap.role=''owner'' and ap.gate_type=''soft'' and ap.approved_by='''||:'O'||''' and ap.evidence_note is null)=1');
select t.adv('accepting returns what happened: advanced', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''plan'' and project_id='''||:'CP'||'''),null,null)=''advanced'' then 1 else t.fail() end', 'ok');
select t.adv('prototype: the owner''s gate leaves the project waiting on the client and does not advance', t.proj('prototype')||';'||t.art('prototype'), :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''prototype'' and project_id='''||:'CP'||'''),null,null)=''waiting_on_client'' then 1 else t.fail() end', 'ok',
  t.is_stage('prototype')||' and '||t.art_status('prototype',1,'draft'));
select t.adv('a client sign-off completes the gates but never advances (D-234)', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft'), :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''client'',(select id from artifacts where type=''prototype'' and project_id='''||:'CP'||'''),''email, 18 Oct'',null)=''ready_to_advance'' then 1 else t.fail() end', 'ok',
  t.is_stage('prototype')||' and '||t.art_status('prototype',1,'approved')||' and (select evidence_note from approvals where role=''client'' and artifact_id in (select id from artifacts where project_id='''||:'CP'||'''))=''email, 18 Oct''');
select t.adv('then the owner advances with advance_stage', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft')||';'||t.appr('prototype',1,'client',5), :'O', 'authenticated', t.go('build_rounds'), 'ok');
select t.adv('a client approval needs an evidence note', t.proj('requirements')||';'||t.art('prd'), :'O', 'authenticated', t.acc('prd','client'), 'error:evidence note');
select t.adv('a blank evidence note is refused', t.proj('requirements')||';'||t.art('prd'), :'O', 'authenticated', t.acc('prd','client','   '), 'error:evidence note');
select t.adv('the client gate cannot come before the owner''s on the prototype', t.proj('prototype')||';'||t.art('prototype'), :'O', 'authenticated', t.acc('prototype','client','email'), 'error:soft approval must come first');
select t.adv('a hard gate added to a stage waits for the soft gate', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated', t.acc('plan','hard'), 'error:soft approval must come first');
select t.adv('soft then hard: the soft gate alone does not advance and is recorded', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''plan'' and project_id='''||:'CP'||'''),null,null)=''recorded'' then 1 else t.fail() end', 'ok', t.is_stage('plan'));
select t.adv('a gate the stage does not have is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.acc('plan','client','email'), 'error:has no client gate');
select t.adv('the same gate twice is refused', t.proj('plan')||';'||t.art('plan')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'');'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.acc('plan','soft'), 'error:already approved');
select t.adv('an old version cannot be accepted', t.proj('plan')||';'||t.art('plan',1)||';'||t.art('plan',2), :'O', 'authenticated',
  'select accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''plan'' and version=1 and project_id='''||:'CP'||'''),null,null)', 'error:not the newest');
select t.adv('an artifact of another type is refused', t.proj('plan')||';'||t.art('plan')||';'||t.art('prd'), :'O', 'authenticated',
  'select accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''prd'' and project_id='''||:'CP'||'''),null,null)', 'error:gated by a plan');
select t.adv('an artifact of another project is refused', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'select accept_gate('''||:'CP'||''',''soft'',(select id from artifacts limit 1),null,null)', 'error:does not belong');
select t.adv('an approved version cannot be accepted again', t.proj('plan')||';'||t.art('plan',1,'approved'), :'O', 'authenticated', t.acc('plan'), 'error:already approved');
select t.adv('a rejected version cannot be accepted', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.acc('plan'), 'error:already rejected');
select t.adv('a superseded version cannot be accepted', t.proj('plan')||';'||t.art('plan',1,'superseded'), :'O', 'authenticated', t.acc('plan'), 'error:already superseded');
select t.adv('a round number is refused outside build rounds', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.acc('plan','soft',null,1), 'error:only build rounds');
select t.adv('a paused project cannot be accepted', t.proj('plan','paused')||';'||t.art('plan'), :'O', 'authenticated', t.acc('plan'), 'error:accept_gate: project is paused');
select t.adv('a closed project cannot be accepted', t.proj('plan','closed')||';'||t.art('plan'), :'O', 'authenticated', t.acc('plan'), 'error');
select t.adv('the other stages: a hard gate on the deployment checklist advances to handover', t.proj('deploy_prep')||';'||t.art('deployment_checklist'), :'O', 'authenticated', t.acc('deployment_checklist','hard'), 'ok', t.is_stage('handover'));
select t.adv('accept_gate: a failed advance leaves no approval behind', t.proj('handover')||';'||t.art('handover_guide')||';insert into change_requests(project_id,description,status,decision) values (''cccccccc-0000-0000-0000-000000000001'',''cr'',''accepted'',''accept_mini_round'')', :'O', 'authenticated',
  'do $x$ begin begin perform accept_gate('''||:'CP'||''',''hard'',(select id from artifacts where type=''handover_guide'' and project_id='''||:'CP'||'''),null,null); exception when others then null; end; end $x$', 'ok',
  '(select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'CP'||''')=0 and '||t.art_status('handover_guide',1,'draft')||' and '||t.is_stage('handover'));
select t.adv('handover: accepting with nothing outstanding closes the project', t.proj('handover')||';'||t.art('handover_guide'), :'O', 'authenticated', t.acc('handover_guide','hard'), 'ok',
  '(select status::text from projects where id='''||:'CP'||''')=''closed''');

\echo '### accept_gate and the next stage''s run'
select t.adv('no stage has an agent yet: advancing queues no run', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'reviewed'), :'O', 'authenticated', t.acc('intake_record'), 'ok',
  t.is_stage('requirements')||' and (select count(*) from stage_runs where project_id='''||:'CP'||''')=0');
select t.adv('a stage with an agent gets a queued run when the project enters it', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'reviewed')||';'||t.agent_on(), :'O', 'authenticated', t.acc('intake_record'), 'ok',
  '(select count(*) from stage_runs where project_id='''||:'CP'||''' and stage=''requirements'' and status=''queued'')=1');
select t.adv('accepting a gate that does not advance queues no run', t.proj('prototype')||';'||t.art('prototype')||';'||t.agent_on(), :'O', 'authenticated', t.acc('prototype'), 'ok',
  '(select count(*) from stage_runs where project_id='''||:'CP'||''')=0');
select t.adv('a client sign-off queues no run', t.proj('requirements')||';'||t.art('prd')||';'||t.agent_on(), :'O', 'authenticated', t.acc('prd','client','email'), 'ok',
  '(select count(*) from stage_runs where project_id='''||:'CP'||''')=0');
select t.adv('a leftover queued run is cancelled and the next stage run is queued', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'reviewed')||';'||t.agent_on()||';insert into stage_runs(project_id,stage) values (''cccccccc-0000-0000-0000-000000000001'',''intake'')', :'O', 'authenticated', t.acc('intake_record'), 'ok',
  '(select count(*) from stage_runs where project_id='''||:'CP'||''' and status=''cancelled'')=1 and (select count(*) from stage_runs where project_id='''||:'CP'||''' and stage=''requirements'' and status=''queued'')=1');

\echo '### the intake rule (D-318)'
select t.adv('intake: the latest round open blocks accept', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'reviewed')||';'||t.ir(2,'open'), :'O', 'authenticated', t.acc('intake_record'), 'error:accept_gate: the latest intake round is not reviewed yet');
select t.adv('intake: the latest round submitted blocks accept', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'submitted'), :'O', 'authenticated', t.acc('intake_record'), 'error:accept_gate: the latest intake round is not reviewed yet');
select t.adv('intake: a reviewed latest round allows accept', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'reviewed')||';'||t.ir(2,'reviewed'), :'O', 'authenticated', t.acc('intake_record'), 'ok', t.is_stage('requirements'));
select t.adv('intake: a project with no round at all is not blocked', t.proj('intake')||';'||t.art('intake_record'), :'O', 'authenticated', t.acc('intake_record'), 'ok', t.is_stage('requirements'));
select t.adv('intake: an unfinished earlier round does not block when the latest is reviewed', t.proj('intake')||';'||t.art('intake_record')||';'||t.ir(1,'open')||';'||t.ir(2,'reviewed'), :'O', 'authenticated', t.acc('intake_record'), 'ok');
select t.adv('advance_stage also refuses intake with an open round, so Advance cannot bypass it', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft')||';'||t.ir(1,'reviewed')||';'||t.ir(2,'open'), :'O', 'authenticated', t.go('requirements'), 'error:advance_stage: the latest intake round is not reviewed yet');
select t.adv('advance_stage allows intake with a reviewed round', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft')||';'||t.ir(1,'reviewed'), :'O', 'authenticated', t.go('requirements'), 'ok');
select t.adv('the intake rule applies to no other stage', t.proj('plan')||';'||t.art('plan')||';'||t.ir(1,'open'), :'O', 'authenticated', t.acc('plan'), 'ok');

\echo '### accept_gate for build rounds'
select t.adv('a round in review is accepted: the round and its summary become approved', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rnd(2,'building')||';'||t.rs(1), :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''round_summary'' and project_id='''||:'CP'||'''),null,1)=''recorded'' then 1 else t.fail() end', 'ok',
  '(select status::text from rounds where project_id='''||:'CP'||''' and number=1)=''approved'' and '||t.art_status('round_summary',1,'approved')||' and '||t.is_stage('build_rounds')||' and (select status::text from rounds where project_id='''||:'CP'||''' and number=2)=''building''');
select t.adv('accepting the last round leaves the project ready to advance and does not advance it', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated',
  'select case when accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where type=''round_summary'' and project_id='''||:'CP'||'''),null,1)=''ready_to_advance'' then 1 else t.fail() end', 'ok', t.is_stage('build_rounds'));
select t.adv('a build round must be named', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated', t.acc('round_summary'), 'error:name the build round');
select t.adv('a round that is not in review is refused', t.proj('build_rounds')||';'||t.rnd(1,'building')||';'||t.rs(1), :'O', 'authenticated', t.acc('round_summary','soft',null,1), 'error:not in review');
select t.adv('a summary of another round is refused', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rnd(2,'in_review')||';'||t.rs(1)||';'||t.rs(2,2), :'O', 'authenticated',
  'select accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where content->>''round''=''2'' and project_id='''||:'CP'||'''),null,1)', 'error:not a summary of round 1');
select t.adv('an older summary of the round is refused', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1,1,'superseded')||';'||t.rs(1,2), :'O', 'authenticated',
  'select accept_gate('''||:'CP'||''',''soft'',(select id from artifacts where version=1 and type=''round_summary'' and project_id='''||:'CP'||'''),null,1)', 'error:not the newest');
select t.adv('the same round twice is refused', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.rs(1,1,'approved'), :'O', 'authenticated', t.acc('round_summary','soft',null,1), 'error:already approved');

\echo '### reject_gate (D-234)'
select t.adv('reject_gate: a non-owner is refused', t.proj('plan')||';'||t.art('plan'), :'A', 'authenticated', t.rej('plan'), 'error:not allowed');
select t.adv('reject_gate: the worker is refused', t.proj('plan')||';'||t.art('plan'), null, 'service_role', t.rej('plan'), 'error');
select t.adv('rejecting marks the version rejected, keeps the stage and starts no run', t.proj('plan')||';'||t.art('plan')||';'||t.agent_on(), :'O', 'authenticated', t.rej('plan'), 'ok',
  t.art_status('plan',1,'rejected')||' and '||t.is_stage('plan')||' and (select count(*) from stage_runs where project_id='''||:'CP'||''')=0 and (select count(*) from approvals ap join artifacts a on a.id=ap.artifact_id where a.project_id='''||:'CP'||''')=0');
select t.adv('a rejected version shows as waiting for a new version', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', t.rej('plan')||'; '||t.rg('r.state=''waiting'''), 'ok');
select t.adv('a rejected version cannot be accepted afterwards', t.proj('plan')||';'||t.art('plan',1,'rejected'), :'O', 'authenticated', t.acc('plan'), 'error:already rejected');
select t.adv('a rejected version cannot be advanced past', t.proj('plan')||';'||t.art('plan',1,'rejected')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.go('prototype'), 'error:no current plan');
select t.adv('an approved version cannot be rejected', t.proj('plan')||';'||t.art('plan',1,'approved'), :'O', 'authenticated', t.rej('plan'), 'error:already approved');
select t.adv('an old version cannot be rejected', t.proj('plan')||';'||t.art('plan',1,'draft')||';'||t.art('plan',2), :'O', 'authenticated',
  'select reject_gate('''||:'CP'||''',(select id from artifacts where version=1 and type=''plan'' and project_id='''||:'CP'||'''),null)', 'error:not the newest');
select t.adv('a paused project cannot reject', t.proj('plan','paused')||';'||t.art('plan'), :'O', 'authenticated', t.rej('plan'), 'error:only an active project');
select t.adv('rejecting an artifact of another type is refused', t.proj('plan')||';'||t.art('prd'), :'O', 'authenticated', t.rej('prd'), 'error:gated by a plan');
select t.adv('a round summary can be rejected', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated', t.rej('round_summary',1), 'ok', t.art_status('round_summary',1,'rejected'));
select t.adv('a rejected round summary leaves the round waiting for the agent', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1), :'O', 'authenticated', t.rej('round_summary',1)||'; '||t.rg('r.round=1 and r.state=''waiting'''), 'ok');
select t.adv('the owner cannot write an approval row directly through the API (D-258)', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where type=''plan'' and project_id='''||:'CP'||'''', 'error:permission denied for table approvals');
select t.adv('the same approval cannot be written twice even by a migration', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), null, current_user, t.appr('plan',1,'soft'), 'error:approvals_once');

\echo '### the artifact version block (D-259)'
select t.adv('past the stage, a new plan version is refused for the owner', t.proj('prototype')||';'||t.art('plan'), :'O', 'authenticated', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''plan'',2)', 'error:needs an accepted change request');
select t.adv('past the stage, a new plan version is refused for the worker', t.proj('prototype')||';'||t.art('plan'), null, 'service_role', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''plan'',2)', 'error:needs an accepted change request');
select t.adv('in the stage, a new plan version is allowed', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''plan'',2)', 'ok');
select t.adv('a stage ahead of the artifact''s stage is allowed too', t.proj('intake'), :'O', 'authenticated', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''plan'',1)', 'ok');
select t.adv('past the stage, an accepted change request allows a new version', t.proj('prototype')||';'||t.art('plan')||';insert into change_requests(id,project_id,description,status,decision) values (''dddddddd-0000-0000-0000-000000000001'','''||:'CP'||''',''cr'',''accepted'',''accept_mini_round'')', :'O', 'authenticated',
  'insert into artifacts(project_id,type,version,change_request_id) values ('''||:'CP'||''',''plan'',2,''dddddddd-0000-0000-0000-000000000001'')', 'ok');
select t.adv('a change request that is not accepted does not allow it', t.proj('prototype')||';'||t.art('plan')||';insert into change_requests(id,project_id,description,status) values (''dddddddd-0000-0000-0000-000000000001'','''||:'CP'||''',''cr'',''received'')', :'O', 'authenticated',
  'insert into artifacts(project_id,type,version,change_request_id) values ('''||:'CP'||''',''plan'',2,''dddddddd-0000-0000-0000-000000000001'')', 'error:needs an accepted change request');
select t.adv('a deployed change request does not allow it either', t.proj('prototype')||';'||t.art('plan')||';insert into change_requests(id,project_id,description,status,decision) values (''dddddddd-0000-0000-0000-000000000001'','''||:'CP'||''',''cr'',''deployed'',''accept_mini_round'')', :'O', 'authenticated',
  'insert into artifacts(project_id,type,version,change_request_id) values ('''||:'CP'||''',''plan'',2,''dddddddd-0000-0000-0000-000000000001'')', 'error:needs an accepted change request');
select t.adv('a release note is exempt', t.proj('handover'), :'O', 'authenticated', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''release_note'',1)', 'ok');
select t.adv('a round summary is allowed during build rounds', t.proj('build_rounds')||';'||t.rs(1), :'O', 'authenticated', 'insert into artifacts(project_id,type,version,content) values ('''||:'CP'||''',''round_summary'',2,''{"round": 1}'')', 'ok');
select t.adv('a round summary is refused after build rounds', t.proj('qc_report')||';'||t.rs(1), :'O', 'authenticated', 'insert into artifacts(project_id,type,version,content) values ('''||:'CP'||''',''round_summary'',2,''{"round": 1}'')', 'error:needs an accepted change request');
select t.adv('an artifact type with no gate is not blocked', t.proj('handover'), :'O', 'authenticated', 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''backlog'',1)', 'ok');
select t.adv('the SQL editor and migrations are not blocked', t.proj('prototype')||';'||t.art('plan'), null, current_user, 'insert into artifacts(project_id,type,version) values ('''||:'CP'||''',''plan'',2)', 'ok');

\echo '### review fixes'
select t.adv('the worker cannot write an approval row either', t.proj('plan')||';'||t.art('plan'), null, 'service_role',
  'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''soft'' from artifacts where type=''plan'' and project_id='''||:'CP'||'''', 'error:permission denied for table approvals');
select t.adv('build rounds: a round is accepted only at its soft gate', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''build_rounds'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated', t.acc('round_summary','hard',null,1), 'error:a build round is accepted at its soft gate');
select t.adv('build rounds: reject needs the round in review', t.proj('build_rounds')||';'||t.rnd(1,'building')||';'||t.rs(1), :'O', 'authenticated', t.rej('round_summary',1), 'error:reject_gate: round 1 is not in review');
select t.adv('handover: an accepted change request that is not deployed means not ready to advance', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard')||';insert into change_requests(project_id,description,status,decision) values (''cccccccc-0000-0000-0000-000000000001'',''cr'',''accepted'',''accept_mini_round'')', :'O', 'authenticated',
  t.rg('not r.ready_to_advance'), 'ok');
