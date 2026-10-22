-- Checks added after the first mutation run (P1-T13): each one covers a rule that a deliberate break
-- (supabase/tests/mutations/) got past. Loaded after review_suite.sql, which defines t.adv and the builders.
\set O '00000000-0000-0000-0000-0000000000a0'

-- Passes when the statement, run as the role, returns or touches no row (and does not error).
create function t.none(name text, setup text, uid uuid, rl text, stmt text) returns text language sql as
$$ select t.adv(name, setup, uid, rl,
  format('do $x$ declare n bigint; begin execute %L; get diagnostics n = row_count; if n > 0 then raise exception ''saw %% rows'', n; end if; end $x$', stmt),
  'ok') $$;

\echo '### coverage: approvals, projects and rounds'
select t.adv('an owner-role approval on the client gate is refused by the table constraint', t.proj('requirements')||';'||t.art('prd'), null, current_user, 'insert into approvals(artifact_id,approved_by,role,gate_type) select id,'''||:'O'||''',''owner'',''client'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''prd''', 'error:role_matches_gate');
select t.adv('a client-role record on a soft gate is refused by the table constraint', t.proj('plan')||';'||t.art('plan'), null, current_user, 'insert into approvals(artifact_id,approved_by,role,gate_type,evidence_note) select id,'''||:'O'||''',''client'',''soft'',''email'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''plan''', 'error:role_matches_gate');
select t.adv('owner cannot create a project that is already paused', 'select 1', :'O', 'authenticated', 'insert into projects(name,status) values (''N'',''paused'')', 'error:starts active');
select t.adv('owner cannot change the close reason of a closed project', t.proj('closed','closed')||';update projects set close_reason=''cancelled'' where id=''cccccccc-0000-0000-0000-000000000001''', :'O', 'authenticated', 'update projects set close_reason=''completed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close function');
select t.adv('the table itself refuses a close reason on an open project', t.proj('plan'), null, current_user, 'update projects set close_reason=''completed'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:close_reason_needs_closed');
select t.adv('rounds: a round still in review is refused even with an approved summary', t.proj('build_rounds')||';'||t.rnd(1,'in_review')||';'||t.rs(1)||';'||t.appr('round_summary',1,'soft'), :'O', 'authenticated', t.go('qc_report'), 'error:build round');

\echo '### coverage: tables a non-owner must not see, with rows present'
select t.none('a non-owner cannot read the run logs', 'insert into stage_runs(id,project_id,stage,status) values (''ffffffff-0000-0000-0000-0000000000f1'',''22222222-2222-2222-2222-222222222222'',''plan'',''running'');insert into run_logs(run_id,message) values (''ffffffff-0000-0000-0000-0000000000f1'',''log'')', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from run_logs');
select t.none('a non-owner cannot read the pause requests', 'insert into run_approvals(run_id,kind,command) values (''33333333-3333-3333-3333-333333333333'',''delete_files'',''rm -r x'')', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from run_approvals');
select t.none('a non-owner cannot read the email log', 'insert into email_log(project_id,recipient_role,recipient,event,dedupe_key) values (''11111111-1111-1111-1111-111111111111'',''client'',''r@x'',''prd_ready'',''cov-key'')', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from email_log');
select t.none('a non-owner cannot read the gate config', 'select 1', '00000000-0000-0000-0000-0000000000a1'::uuid, 'authenticated', 'select * from gate_config');
