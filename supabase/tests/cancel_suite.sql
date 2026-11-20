-- Cancel project and End run (P2-T20, P2-T21, D-233, D-237, D-301, D-303): cancel_project, end_run and the
-- ended_at column of stage_runs. Loaded after runner_suite.sql, which defines t.rid, t.sr, t.is and t.isnull.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P '''cccccccc-0000-0000-0000-000000000001'''

-- cancel_project on the scratch project with a reason.
create function t.cp(why text default 'client left') returns text language sql as
$$ select format('select cancel_project(%L, %L)', 'cccccccc-0000-0000-0000-000000000001', why) $$;
-- The project is closed as cancelled, in the stage it was in.
create function t.cancelled_in(stg text) returns text language sql as
$$ select format('(select status=''closed'' and close_reason=''cancelled'' and stage=%L from projects where id=%L)', stg, 'cccccccc-0000-0000-0000-000000000001') $$;
-- The project as it is after a cancel: closed, reason cancelled (set by the database owner, no owner session needed).
create function t.closed() returns text language sql as
$$ select format('update projects set status=''closed'', close_reason=''cancelled'' where id=%L', 'cccccccc-0000-0000-0000-000000000001') $$;
create function t.er(n int) returns text language sql as
$$ select format('select end_run(%s)', t.rid(n)) $$;

\echo '### who can cancel a project'
select t.adv('cancel: a non-owner is refused', t.proj('plan'), :'A', 'authenticated', t.cp(), 'error:cancel_project: not allowed');
select t.adv('cancel: the worker is refused', t.proj('plan'), null, 'service_role', t.cp(), 'error');
select t.adv('cancel: anon is refused', t.proj('plan'), null, 'anon', t.cp(), 'error');
select t.adv('cancel: the project stays open when a non-owner tries', t.proj('plan'), :'A', 'authenticated', t.cp(), 'error', '(select status=''active'' from projects where id='||:'P'||')');

\echo '### the reason'
select t.adv('cancel: an empty reason is refused', t.proj('plan'), :'O', 'authenticated', t.cp(''), 'error:write the reason first');
select t.adv('cancel: a blank reason is refused', t.proj('plan'), :'O', 'authenticated', t.cp(E'  \n '), 'error:write the reason first');
select t.adv('cancel: a missing reason is refused', t.proj('plan'), :'O', 'authenticated', t.cp(null), 'error:write the reason first');
select t.adv('cancel: a reason over 2000 characters is refused', t.proj('plan'), :'O', 'authenticated', t.cp(repeat('x',2001)), 'error:at most 2000');
select t.adv('cancel: a reason of exactly 2000 characters is kept', t.proj('plan'), :'O', 'authenticated', t.cp(repeat('x',2000)), 'ok',
  '(select length(cancel_reason)=2000 from project_internal where project_id='||:'P'||')');
select t.adv('cancel: the reason is stored trimmed', t.proj('plan'), :'O', 'authenticated', t.cp('  moved to another agency  '), 'ok',
  '(select cancel_reason=''moved to another agency'' from project_internal where project_id='||:'P'||')');
select t.adv('a stored reason cannot be blank (direct write)', t.proj('plan'), :'O', 'authenticated',
  'update project_internal set cancel_reason=''   '' where project_id='||:'P', 'error:cancel_reason_not_blank');
select t.adv('a stored reason of only line breaks is refused too (direct write)', t.proj('plan'), :'O', 'authenticated',
  'update project_internal set cancel_reason=E''\n\t '' where project_id='||:'P', 'error:cancel_reason_not_blank');
select t.adv('cancel: a project without its internal row is refused, not closed without a reason', t.proj('plan')||';delete from project_internal where project_id='||:'P', :'O', 'authenticated', t.cp(), 'error:no internal row',
  '(select status=''active'' from projects where id='||:'P'||')');
select t.adv('a stored reason cannot exceed 2000 characters (direct write)', t.proj('plan'), :'O', 'authenticated',
  'update project_internal set cancel_reason=repeat(''x'',2001) where project_id='||:'P', 'error:cancel_reason_length');

\echo '### what cancelling does'
select t.adv('cancel: the project is closed as cancelled and stays in its stage (plan)', t.proj('plan'), :'O', 'authenticated', t.cp(), 'ok', t.cancelled_in('plan'));
select t.adv('cancel: works at intake', t.proj('intake'), :'O', 'authenticated', t.cp(), 'ok', t.cancelled_in('intake'));
select t.adv('cancel: works in build rounds', t.proj('build_rounds'), :'O', 'authenticated', t.cp(), 'ok', t.cancelled_in('build_rounds'));
select t.adv('cancel: works at deploy prep (the last stage before handover)', t.proj('deploy_prep'), :'O', 'authenticated', t.cp(), 'ok', t.cancelled_in('deploy_prep'));
select t.adv('cancel: works on a paused project', t.proj('plan','paused'), :'O', 'authenticated', t.cp(), 'ok', t.cancelled_in('plan'));
select t.adv('cancel: a project at handover is refused', t.proj('handover'), :'O', 'authenticated', t.cp(), 'error:at handover');
select t.adv('cancel: a closed project is refused', t.proj('plan','closed'), :'O', 'authenticated', t.cp(), 'error:already closed');
select t.adv('cancel: an unknown project is refused', 'select 1', :'O', 'authenticated', 'select cancel_project(''dddddddd-0000-0000-0000-0000000000f1'', ''x'')', 'error:project not found');
select t.adv('cancel: a queued run is cancelled at once', t.proj('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','cancelled')||' and not '||t.isnull(1,'finished_at'));
select t.adv('cancel: a running run is asked to stop', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','cancel_requested')||' and '||t.isnull(1,'finished_at'));
select t.adv('cancel: a waiting run is asked to stop', t.proj('plan')||';'||t.sr(1,'waiting',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','cancel_requested'));
select t.adv('cancel: a run already stopping stays as it is', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','cancel_requested'));
select t.adv('cancel: finished runs keep their status', t.proj('plan')||';'||t.sr(1,'succeeded',1,'1 minute','1 hour','w1')||';'||t.sr(2,'failed',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','succeeded')||' and '||t.is(2,'status','failed'));
select t.adv('cancel: all of the project''s runs are handled in one call', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1')||';'||t.sr(2,'queued'), :'O', 'authenticated', t.cp(), 'ok',
  t.is(1,'status','cancel_requested')||' and '||t.is(2,'status','cancelled'));
select t.adv('cancel: another project''s queued and running runs are left alone',
  t.proj('plan')||';insert into projects(id,name,stage) values (''cccccccc-0000-0000-0000-000000000002'',''D'',''plan'');'
  ||'insert into stage_runs(id,project_id,stage,status) values (''dddddddd-0000-0000-0000-0000000000b2'',''cccccccc-0000-0000-0000-000000000002'',''plan'',''queued'');'
  ||'insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values (''dddddddd-0000-0000-0000-0000000000b3'',''cccccccc-0000-0000-0000-000000000002'',''plan'',''running'',1,now(),''w9'',now())',
  :'O', 'authenticated', t.cp(), 'ok',
  '(select status=''queued'' from stage_runs where id=''dddddddd-0000-0000-0000-0000000000b2'') and (select status=''running'' from stage_runs where id=''dddddddd-0000-0000-0000-0000000000b3'') and (select status=''active'' from projects where id=''cccccccc-0000-0000-0000-000000000002'')');
select t.adv('cancel: its data is kept (artifacts, runs and the reason)', t.proj('plan')||';'||t.art('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', t.cp(), 'ok',
  '(select count(*) from artifacts where project_id='||:'P'||')=1 and (select count(*) from stage_runs where project_id='||:'P'||')=1 and (select cancel_reason from project_internal where project_id='||:'P'||')=''client left''');
select t.adv('a client cannot read the cancel reason (owner-only table)', t.proj('plan'), :'A', 'authenticated',
  'select case when (select count(*) from project_internal)=0 then 1 else t.fail() end', 'ok');

\echo '### a cancelled project does not move'
select t.adv('after cancel: no new run can be queued', t.proj('plan')||';'||t.closed(), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'error:only an active project');
select t.adv('after cancel: no Feedback can be sent', t.proj('plan')||';'||t.art('plan')||';'||t.closed(), :'O', 'authenticated', t.fb('plan'), 'error:only an active project');
select t.adv('after cancel: nothing can be accepted', t.proj('plan')||';'||t.art('plan')||';'||t.closed(), :'O', 'authenticated', t.acc('plan'), 'error');
select t.adv('after cancel: a run still queued is not claimable (the project is closed)', t.proj('plan')||';'||t.sr(1,'queued')||';'||t.closed(), null, 'service_role',
  t.norow('select * from claim_run(''w2'')'), 'ok', t.is(1,'status','queued'));

\echo '### End run'
select t.adv('end_run: a non-owner is refused', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1'), :'A', 'authenticated', t.er(1), 'error:end_run: not allowed');
select t.adv('end_run: the worker is refused', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1'), null, 'service_role', t.er(1), 'error');
select t.adv('end_run: anon is refused', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1'), null, 'anon', t.er(1), 'error');
select t.adv('end_run: the owner ends a failed run', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'ok',
  t.is(1,'status','failed')||' and not '||t.isnull(1,'ended_at'));
select t.adv('end_run: the owner ends a stopped run', t.proj('plan')||';'||t.sr(1,'stopped',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'ok',
  t.is(1,'status','stopped')||' and not '||t.isnull(1,'ended_at'));
select t.adv('end_run: a succeeded run cannot be ended', t.proj('plan')||';'||t.sr(1,'succeeded',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'error:only a failed or stopped run');
select t.adv('end_run: a cancelled run cannot be ended', t.proj('plan')||';'||t.sr(1,'cancelled',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'error:only a failed or stopped run');
select t.adv('end_run: a running run cannot be ended', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'error:only a failed or stopped run');
select t.adv('end_run: a queued run cannot be ended', t.proj('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', t.er(1), 'error:only a failed or stopped run');
select t.adv('end_run: ending twice is refused', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1')||';update stage_runs set ended_at=now() where id='||t.rid(1), :'O', 'authenticated', t.er(1), 'error:already ended');
select t.adv('end_run: an unknown run is refused', 'select 1', :'O', 'authenticated', 'select end_run(''eeeeeeee-0000-0000-0000-0000000000f9'')', 'error:run not found');
select t.adv('end_run: only that run is marked', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1')||';'||t.sr(2,'failed',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'ok',
  t.isnull(2,'ended_at'));
select t.adv('end_run: the project and its stage are untouched', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1'), :'O', 'authenticated', t.er(1), 'ok',
  '(select status=''active'' and stage=''plan'' from projects where id='||:'P'||')');
select t.adv('ended_at is allowed only on a failed or stopped run (direct write)', t.proj('plan')||';'||t.sr(1,'queued'), null, current_user,
  'update stage_runs set ended_at=now() where id='||t.rid(1), 'error:run_ended_only_when_over');
select t.adv('a failed run can be ended after the project is cancelled', t.proj('plan')||';'||t.sr(1,'failed',1,'1 minute','1 hour','w1')||';'||t.closed(), :'O', 'authenticated', t.er(1), 'ok',
  '(select ended_at is not null from stage_runs where id='||t.rid(1)||')');
