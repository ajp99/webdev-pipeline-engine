-- Checks added after the first mutation run (P1-T13): each one covers a rule that a deliberate break
-- (supabase/tests/mutations/) got past. Loaded after review_suite.sql, which defines t.adv and the builders.
\set O '00000000-0000-0000-0000-0000000000a0'
\set C '00000000-0000-0000-0000-0000000000c1'

-- Passes when the statement, run as the role, returns or touches no row (and does not error).
create function t.none(name text, setup text, uid uuid, rl text, stmt text) returns text language sql as
$$ select t.adv(name, setup, uid, rl,
  format('do $x$ declare n bigint; begin execute %L; get diagnostics n = row_count; if n > 0 then raise exception ''saw %% rows'', n; end if; end $x$', stmt),
  'ok') $$;

\echo '### coverage: tables a client must not see, with rows present'
select t.none('client C cannot read the run logs of their own project', t.proj('build_rounds')||';insert into stage_runs(id,project_id,stage,status) values (''ffffffff-0000-0000-0000-0000000000f1'',''cccccccc-0000-0000-0000-000000000001'',''build_rounds'',''running'');insert into run_logs(run_id,message) values (''ffffffff-0000-0000-0000-0000000000f1'',''log'')', :'C'::uuid, 'authenticated', 'select * from run_logs');
select t.none('client C cannot read the pause requests of their own project', t.proj('build_rounds')||';insert into stage_runs(id,project_id,stage,status) values (''ffffffff-0000-0000-0000-0000000000f1'',''cccccccc-0000-0000-0000-000000000001'',''build_rounds'',''waiting'');insert into run_approvals(run_id,kind,command) values (''ffffffff-0000-0000-0000-0000000000f1'',''delete_files'',''rm -r x'')', :'C'::uuid, 'authenticated', 'select * from run_approvals');

\echo '### coverage: approvals, projects and rounds'
select t.adv('an owner-role approval on the client gate is refused even for the worker', t.proj('requirements')||';'||t.art('prd'), null, 'service_role', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''client'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''prd''', 'error:role_matches_gate');
select t.adv('a client-role approval on a soft gate is refused even for the worker', t.proj('plan')||';'||t.art('plan'), null, 'service_role', 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'C'||''',''client'',''soft'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error:role_matches_gate');
select t.adv('owner cannot create a project that is already paused', 'select 1', :'O', 'authenticated', 'insert into projects(name,status) values (''N'',''paused'')', 'error:starts active');
select t.adv('owner cannot change the close reason of a closed project', t.proj('closed','closed')||';update projects set close_reason=''cancelled'' where id=''cccccccc-0000-0000-0000-000000000001''', :'O', 'authenticated', 'update projects set close_reason=''completed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close function');
select t.adv('the table itself refuses a close reason on an open project', t.proj('plan'), null, current_user, 'update projects set close_reason=''completed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close_reason_needs_closed');
select t.adv('rounds: a round still in review is refused even with an approved summary', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';'||t.appr('round_summary',1,'soft'), :'O', 'authenticated', t.go('qc_report'), 'error:build round');

\echo '### coverage: intake round guard'
select t.adv('client C cannot renumber their intake round', t.proj('intake')||';insert into intake_rounds(project_id,round,status) values (''cccccccc-0000-0000-0000-000000000001'',1,''open'')', :'C', 'authenticated', 'update intake_rounds set round=5', 'error:submit or reopen');
select t.adv('submitting a round stamps submitted_at', t.proj('intake')||';insert into intake_rounds(project_id,round,status) values (''cccccccc-0000-0000-0000-000000000001'',1,''open'')', :'C', 'authenticated', 'update intake_rounds set status=''submitted''', 'ok', '(select submitted_at from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'') is not null');
select t.none('client C cannot submit a round once the project has left intake', t.proj('plan')||';insert into intake_rounds(project_id,round,status) values (''cccccccc-0000-0000-0000-000000000001'',1,''open'')', :'C'::uuid, 'authenticated', 'update intake_rounds set status=''submitted''');
