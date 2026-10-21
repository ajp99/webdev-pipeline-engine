-- Stage runner queue functions (P2-T04, D-278, D-301, D-302, D-305): enqueue_run, claim_run,
-- heartbeat_run, finish_run, request_run_cancel. Loaded after review_suite.sql, which defines t.adv and t.proj.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P '''cccccccc-0000-0000-0000-000000000001'''

-- Builders. Run n of scratch project C (stage plan). att = attempts, hb = heartbeat age, qago = queued age.
create function t.rid(n int) returns text language sql as
$$ select format('%L::uuid', format('dddddddd-0000-0000-0000-%s', lpad(n::text, 12, '0'))) $$;
create function t.sr(n int, st text, att int default 0, hb text default null, qago text default '1 minute', worker text default null)
returns text language sql as
$$ select format('insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,queued_at,claimed_by,started_at) values (%s,%L,''plan'',%L,%s,%s,now()-interval %L,%L,%s)',
  t.rid(n), 'cccccccc-0000-0000-0000-000000000001', st, att,
  case when hb is null then 'null' else format('now()-interval %L', hb) end, qago, worker,
  case when st = 'queued' then 'null' else 'now()-interval ''1 hour''' end) $$;
-- A boolean expression: column col of run n, as text, equals val.
create function t.is(n int, col text, val text) returns text language sql as
$$ select format('(select %s::text from stage_runs where id=%s)=%L', col, t.rid(n), val) $$;
create function t.isnull(n int, col text) returns text language sql as
$$ select format('(select %s from stage_runs where id=%s) is null', col, t.rid(n)) $$;
-- Passes the statement only if it returns no row.
create function t.norow(stmt text) returns text language sql as
$$ select format('do $x$ begin if exists (%s) then raise exception ''got a row''; end if; end $x$', stmt) $$;

\echo '### runner: enqueue_run'
select t.adv('the owner can queue a run for the current stage', t.proj('plan'), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'ok', '(select count(*) from stage_runs where project_id='||:'P'||' and status=''queued'' and stage=''plan'')=1');
select t.adv('the worker can queue a run too', t.proj('plan'), null, 'service_role', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'ok', '(select count(*) from stage_runs where project_id='||:'P'||' and status=''queued'')=1');
select t.adv('a user who is not the owner cannot queue a run', t.proj('plan'), :'A', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'error:not allowed');
select t.adv('anon cannot queue a run', t.proj('plan'), null, 'anon', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'error');
select t.adv('a run for a stage the project is not in is refused', t.proj('plan'), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''prototype'')', 'error:is in stage plan, not prototype');
select t.adv('a paused project cannot be queued', t.proj('plan','paused'), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'error:only an active project');
select t.adv('an unknown project is refused', 'select 1', :'O', 'authenticated', 'select enqueue_run(''eeeeeeee-0000-0000-0000-000000000001'',''plan'')', 'error:project not found');
select t.adv('a second queued run for the project is refused', t.proj('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'error:already has a queued run');
select t.adv('a queued run can be added while another run is running', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select enqueue_run('||:'P'||'::uuid,''plan'')', 'ok');

\echo '### runner: claim_run'
select t.adv('the owner session cannot claim a run', t.proj('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', 'select * from claim_run(''w1'')', 'error');
select t.adv('anon cannot claim a run', t.proj('plan')||';'||t.sr(1,'queued'), null, 'anon', 'select * from claim_run(''w1'')', 'error');
select t.adv('a claim needs a worker name', t.proj('plan')||';'||t.sr(1,'queued'), null, 'service_role', 'select * from claim_run(''  '')', 'error:needs a name');
select t.adv('the worker claims a queued run and it starts running', t.proj('plan')||';'||t.sr(1,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok',
  t.is(1,'status','running')||' and '||t.is(1,'claimed_by','w1')||' and '||t.is(1,'attempts','1')||' and not '||t.isnull(1,'heartbeat_at')||' and not '||t.isnull(1,'started_at'));
select t.adv('a claim returns the run it took', t.proj('plan')||';'||t.sr(1,'queued'), null, 'service_role',
  'do $x$ declare r public.stage_runs; begin select * into r from claim_run(''w1''); if r.id is distinct from '||t.rid(1)||' or r.status <> ''running'' then raise exception ''wrong row''; end if; end $x$', 'ok');
select t.adv('an empty queue returns no row', t.proj('plan'), null, 'service_role', t.norow('select * from claim_run(''w1'')'), 'ok');
select t.adv('the oldest queued run is claimed first', t.proj('plan')||';'||t.sr(1,'queued',0,null,'10 minutes')||';'||t.sr(2,'queued',0,null,'5 minutes'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok',
  t.is(1,'status','running')||' and '||t.is(2,'status','queued'));
select t.adv('a project with a running run is skipped', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w0')||';'||t.sr(2,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok',
  t.is(2,'status','queued')||' and '||t.is(1,'claimed_by','w0'));
select t.adv('a project with a waiting run is skipped', t.proj('plan')||';'||t.sr(1,'waiting',1,'1 minute','1 hour','w0')||';'||t.sr(2,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok', t.is(2,'status','queued'));
select t.adv('a project with a cancel_requested run is skipped', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w0')||';'||t.sr(2,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok', t.is(2,'status','queued'));
select t.adv('another project''s run is claimed when the first project is busy', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w0')||';'||t.sr(2,'queued',0,null,'10 minutes')||
  ';insert into stage_runs(id,project_id,stage,status,queued_at) values (''dddddddd-0000-0000-0000-0000000000f1'',''22222222-2222-2222-2222-222222222222'',''intake'',''queued'',now()-interval ''2 minutes'')',
  null, 'service_role', 'select * from claim_run(''w1'')', 'ok',
  '(select status::text from stage_runs where id=''dddddddd-0000-0000-0000-0000000000f1'')=''running'' and '||t.is(2,'status','queued'));
select t.adv('a queued run on a paused project is not claimed', t.proj('plan','paused')||';'||t.sr(1,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok', t.is(1,'status','queued'));

-- The functions refuse a caller who is not the worker even if a grant were widened by mistake.
select t.adv('claim_run refuses the owner session even if the grant were widened', t.proj('plan')||';'||t.sr(1,'queued')||';grant execute on function claim_run(text) to authenticated', :'O', 'authenticated', 'select * from claim_run(''w1'')', 'error:not allowed');
select t.adv('heartbeat_run refuses the owner session even if the grant were widened', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w1')||';grant execute on function heartbeat_run(uuid,text) to authenticated', :'O', 'authenticated', 'select heartbeat_run('||t.rid(1)||',''w1'')', 'error:not allowed');
select t.adv('finish_run refuses the owner session even if the grant were widened', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w1')||';grant execute on function finish_run(uuid,text,public.run_status,bigint) to authenticated', :'O', 'authenticated', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'')', 'error:not allowed');

select t.adv('a queued run for a stage the project has left is not claimed', t.proj('plan')||';'||t.sr(1,'queued')||';update stage_runs set stage=''intake'' where id='||t.rid(1), null, 'service_role', 'select * from claim_run(''w1'')', 'ok', t.is(1,'status','queued'));
select t.adv('a queued run that already used both attempts is failed, not left to block the queue', t.proj('plan')||';'||t.sr(1,'queued',2,null,'10 minutes')||';'||t.sr(2,'queued'), null, 'service_role', 'select * from claim_run(''w1'')', 'ok',
  t.is(1,'status','failed')||' and not '||t.isnull(1,'finished_at')||' and '||t.is(2,'status','running'));

\echo '### runner: stale runs (D-305)'
select t.adv('a stale running run goes back to the queue and is claimed again by the next worker', t.proj('plan')||';'||t.sr(1,'running',1,'11 minutes','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','running')||' and '||t.is(1,'claimed_by','w2')||' and '||t.is(1,'attempts','2'));
select t.adv('a stale run is re-queued even when it has no heartbeat yet', t.proj('plan')||';'||t.sr(1,'running',1,null,'1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'claimed_by','w2')||' and '||t.is(1,'attempts','2'));
select t.adv('a run with a fresh heartbeat is left alone', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','running')||' and '||t.is(1,'claimed_by','w0')||' and '||t.is(1,'attempts','1'));
select t.adv('a stale run goes back to the queue with its claim, heartbeat and finish time cleared and a new queue time', t.proj('plan','paused')||';'||t.sr(1,'running',1,'11 minutes','2 hours','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','queued')||' and '||t.isnull(1,'claimed_by')||' and '||t.isnull(1,'heartbeat_at')||' and '||t.isnull(1,'finished_at')||' and (select queued_at > now() - interval ''1 minute'' from stage_runs where id='||t.rid(1)||')');
select t.adv('a stale run that used both attempts fails', t.proj('plan')||';'||t.sr(1,'running',2,'11 minutes','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','failed')||' and not '||t.isnull(1,'finished_at'));
select t.adv('a stale cancel_requested run is cancelled', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'11 minutes','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','cancelled')||' and not '||t.isnull(1,'finished_at'));
select t.adv('a stale cancel_requested run frees the slot for the next queued run', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'11 minutes','1 hour','w0')||';'||t.sr(2,'queued'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok',
  t.is(1,'status','cancelled')||' and '||t.is(2,'status','running'));
select t.adv('a fresh cancel_requested run is not cancelled by a claim', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'5 minutes','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok', t.is(1,'status','cancel_requested'));
select t.adv('a waiting run is never re-queued, however old', t.proj('plan')||';'||t.sr(1,'waiting',1,'3 hours','1 hour','w0'), null, 'service_role', 'select * from claim_run(''w2'')', 'ok', t.is(1,'status','waiting'));

\echo '### runner: heartbeat_run'
select t.adv('the holder refreshes the heartbeat', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w1'), null, 'service_role', 'select heartbeat_run('||t.rid(1)||',''w1'')', 'ok',
  '(select heartbeat_at > now() - interval ''1 minute'' from stage_runs where id='||t.rid(1)||')');
select t.adv('the heartbeat reports a cancel request', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), null, 'service_role',
  'do $x$ begin if heartbeat_run('||t.rid(1)||',''w1'') is distinct from ''cancel_requested'' then raise exception ''wrong status''; end if; end $x$', 'ok');
select t.adv('another worker gets nothing and changes nothing', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w1'), null, 'service_role',
  'do $x$ begin if heartbeat_run('||t.rid(1)||',''w2'') is not null then raise exception ''should be null''; end if; end $x$', 'ok',
  '(select heartbeat_at < now() - interval ''4 minutes'' from stage_runs where id='||t.rid(1)||')');
select t.adv('a finished run is not touched', t.proj('plan')||';'||t.sr(1,'succeeded',1,'5 minutes','1 hour','w1'), null, 'service_role',
  'do $x$ begin if heartbeat_run('||t.rid(1)||',''w1'') is not null then raise exception ''should be null''; end if; end $x$', 'ok');
select t.adv('the owner session cannot send a heartbeat', t.proj('plan')||';'||t.sr(1,'running',1,'5 minutes','1 hour','w1'), :'O', 'authenticated', 'select heartbeat_run('||t.rid(1)||',''w1'')', 'error');

\echo '### runner: finish_run'
select t.adv('a successful run is recorded with its tokens', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'',500)', 'ok',
  t.is(1,'status','succeeded')||' and '||t.is(1,'tokens_used','500')||' and not '||t.isnull(1,'finished_at'));
select t.adv('tokens add up over attempts', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1')||';update stage_runs set tokens_used=100', null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'',50)', 'ok', t.is(1,'tokens_used','150'));
select t.adv('a failed run with an attempt left goes back to the queue', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''failed'',10)', 'ok',
  t.is(1,'status','queued')||' and '||t.isnull(1,'claimed_by')||' and '||t.isnull(1,'heartbeat_at')||' and '||t.isnull(1,'finished_at')||' and '||t.is(1,'tokens_used','10'));
select t.adv('a failed run on its second attempt stays failed', t.proj('plan')||';'||t.sr(1,'running',2,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''failed'')', 'ok',
  t.is(1,'status','failed')||' and not '||t.isnull(1,'finished_at'));
select t.adv('a failure after a cancel request ends cancelled, with no retry', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''failed'')', 'ok', t.is(1,'status','cancelled'));
select t.adv('a success after a cancel request is kept as a success', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'')', 'ok', t.is(1,'status','succeeded'));
select t.adv('the watchdog can stop a run', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''stopped'')', 'ok', t.is(1,'status','stopped'));
select t.adv('the worker can report a cancelled run', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''cancelled'')', 'ok', t.is(1,'status','cancelled'));
select t.adv('a finished run frees the project''s slot', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1')||';'||t.sr(2,'queued'), null, 'service_role',
  'select finish_run('||t.rid(1)||',''w1'',''succeeded'');select * from claim_run(''w1'')', 'ok', t.is(2,'status','running'));
select t.adv('another worker cannot finish the run', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w2'',''succeeded'')', 'error:does not hold');
select t.adv('a run that already finished cannot be finished again', t.proj('plan')||';'||t.sr(1,'succeeded',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''failed'')', 'error:does not hold');
select t.adv('running is not a final status', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''running'')', 'error:not a final status');
select t.adv('queued is not a final status', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''queued'')', 'error:not a final status');
select t.adv('negative tokens are refused', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'',-5)', 'error:negative');
select t.adv('the owner session cannot finish a run', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select finish_run('||t.rid(1)||',''w1'',''succeeded'')', 'error');

\echo '### runner: request_run_cancel'
select t.adv('the owner cancels a queued run at once', t.proj('plan')||';'||t.sr(1,'queued'), :'O', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'ok', t.is(1,'status','cancelled')||' and not '||t.isnull(1,'finished_at'));
select t.adv('the owner asks a running run to stop', t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'ok', t.is(1,'status','cancel_requested')||' and '||t.isnull(1,'finished_at'));
select t.adv('the owner asks a waiting run to stop', t.proj('plan')||';'||t.sr(1,'waiting',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'ok', t.is(1,'status','cancel_requested'));
select t.adv('asking twice is harmless', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'ok', t.is(1,'status','cancel_requested'));
select t.adv('a finished run cannot be cancelled', t.proj('plan')||';'||t.sr(1,'succeeded',1,'1 minute','1 hour','w1'), :'O', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'error:already succeeded');
select t.adv('an unknown run is refused', 'select 1', :'O', 'authenticated', 'select request_run_cancel(''eeeeeeee-0000-0000-0000-000000000009'')', 'error:run not found');
select t.adv('a user who is not the owner cannot cancel a run', t.proj('plan')||';'||t.sr(1,'queued'), :'A', 'authenticated', 'select request_run_cancel('||t.rid(1)||')', 'error:not allowed');
select t.adv('anon cannot cancel a run', t.proj('plan')||';'||t.sr(1,'queued'), null, 'anon', 'select request_run_cancel('||t.rid(1)||')', 'error');
select t.adv('the worker cannot use the owner''s cancel', t.proj('plan')||';'||t.sr(1,'queued'), null, 'service_role', 'select request_run_cancel('||t.rid(1)||')', 'error');

\echo '### runner: a whole life of a run'
select t.adv('queue, claim, heartbeat, fail once, claim again, succeed', t.proj('plan'), null, 'service_role',
  $q$do $x$ declare r public.stage_runs; rid uuid; st public.run_status; begin
    rid := enqueue_run('cccccccc-0000-0000-0000-000000000001', 'plan');
    select * into r from claim_run('w1'); if r.id <> rid or r.attempts <> 1 then raise exception 'first claim'; end if;
    if heartbeat_run(rid, 'w1') <> 'running' then raise exception 'heartbeat'; end if;
    if finish_run(rid, 'w1', 'failed', 5) <> 'queued' then raise exception 'retry'; end if;
    select * into r from claim_run('w1'); if r.id <> rid or r.attempts <> 2 then raise exception 'second claim'; end if;
    if finish_run(rid, 'w1', 'succeeded', 7) <> 'succeeded' then raise exception 'finish'; end if;
    if (select tokens_used from stage_runs where id = rid) <> 12 then raise exception 'tokens'; end if;
  end $x$$q$, 'ok');
