-- The worker's stage artifact function (P2-T23): complete_stage_artifact, and the stages that auto-queue a
-- run (stage_has_agent). Loaded after runner_suite.sql, which defines t.adv, t.proj, t.sr and the scratch project P.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P '''cccccccc-0000-0000-0000-000000000001'''

-- The call: run n writes an artifact of type typ with the given content (json text) for the scratch project.
create function t.csa(n int, typ text default 'plan', content text default '{"body": "x"}', model text default 'stub', notes text default null) returns text language sql as
$$ select format('select complete_stage_artifact(%L::uuid, %s, %L, %L, %L::jsonb, %L, %L::jsonb)', 'cccccccc-0000-0000-0000-000000000001', t.rid(n), 'w1', typ, content, model, notes) $$;
-- A valid PRD (D-325) and empty notes, for the requirements stage.
create function t.prd_json() returns text language sql as
$$ select '{"sections":{"business":"b","site_map":"Home; Privacy policy; Cookie notice","features":"Contact form","content":"c","brand":"b","non_functional":"Lighthouse 80+"},"spam_protection":"honeypot","change_summary":""}' $$;
-- A running run 1 in the plan stage.
create function t.running() returns text language sql as
$$ select t.proj('plan')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1') $$;
create function t.plans() returns text language sql as
$$ select format('(select count(*) from artifacts where project_id=%L and type=''plan'')', 'cccccccc-0000-0000-0000-000000000001') $$;

\echo '### stage artifact: complete_stage_artifact'
select t.adv('the worker writes a plan draft for its running run', t.running(), null, 'service_role', t.csa(1), 'ok',
  '(select count(*) from artifacts where project_id='||:'P'||' and type=''plan'' and version=1 and status=''draft'' and content->>''body''=''x'' and content->>''model''=''stub'')=1');
select t.adv('the next write is version 2 and the old draft is superseded', t.running()||';'||t.art('plan'), null, 'service_role', t.csa(1), 'ok',
  '(select status::text from artifacts where project_id='||:'P'||' and type=''plan'' and version=1)=''superseded'' and (select status::text from artifacts where project_id='||:'P'||' and type=''plan'' and version=2)=''draft''');
select t.adv('the newest version being approved refuses a late write', t.running()||';'||t.art('plan',1,'approved'), null, 'service_role', t.csa(1), 'error:already approved',
  t.plans()||'=1 and (select status::text from artifacts where project_id='||:'P'||' and type=''plan'' and version=1)=''approved''');
select t.adv('an older approved version does not block a write when a newer draft exists', t.running()||';'||t.art('plan',1,'approved')||';'||t.art('plan',2), null, 'service_role', t.csa(1), 'ok',
  '(select max(version) from artifacts where project_id='||:'P'||' and type=''plan'')=3');
select t.adv('a run claimed by another worker cannot write', t.running(), null, 'service_role', replace(t.csa(1), '''w1''', '''w2'''), 'error:not claimed by this worker');
select t.adv('a missing worker name is refused', t.running(), null, 'service_role', 'select complete_stage_artifact('||:'P'||'::uuid, '||t.rid(1)||', null, ''plan'', ''{"a":1}'', ''m'')', 'error:not claimed by this worker');
select t.adv('the owner session cannot call it', t.running(), :'O', 'authenticated', t.csa(1), 'error');
select t.adv('it refuses the owner session even if the grant were widened', t.running()||';grant execute on function complete_stage_artifact(uuid,uuid,text,public.artifact_type,jsonb,text,jsonb) to authenticated', :'O', 'authenticated', t.csa(1), 'error:not allowed');
select t.adv('it refuses a non-owner even if the grant were widened', t.running()||';grant execute on function complete_stage_artifact(uuid,uuid,text,public.artifact_type,jsonb,text,jsonb) to authenticated', :'A', 'authenticated', t.csa(1), 'error:not allowed');
select t.adv('anon cannot call it', t.running(), null, 'anon', t.csa(1), 'error');
select t.adv('an unknown project is refused', 'select 1', null, 'service_role', 'select complete_stage_artifact(''eeeeeeee-0000-0000-0000-000000000001'', '||t.rid(1)||', ''w1'', ''plan'', ''{"a":1}'', ''m'')', 'error:project not found');
select t.adv('a paused project is refused', t.proj('plan','paused')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', t.csa(1), 'error:must be active');
select t.adv('a run that does not exist is refused', t.proj('plan'), null, 'service_role', t.csa(1), 'error:run not found');
select t.adv('another project''s run is refused', t.proj('plan')||';insert into projects(id,name,stage) values (''cccccccc-0000-0000-0000-000000000002'',''D'',''plan'');insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values ('||t.rid(2)||',''cccccccc-0000-0000-0000-000000000002'',''plan'',''running'',1,now(),''w1'',now())', null, 'service_role', t.csa(2), 'error:run not found');
select t.adv('a queued run cannot write', t.proj('plan')||';'||t.sr(1,'queued'), null, 'service_role', t.csa(1), 'error:not claimed by this worker');
select t.adv('a cancel_requested run cannot write', t.proj('plan')||';'||t.sr(1,'cancel_requested',1,'1 minute','1 hour','w1'), null, 'service_role', t.csa(1), 'error:must be running');
select t.adv('a finished run cannot write', t.proj('plan')||';'||t.sr(1,'succeeded',1,'1 minute','1 hour','w1'), null, 'service_role', t.csa(1), 'error:must be running');
select t.adv('a run of another stage cannot write', t.proj('prototype')||';'||t.sr(1,'running',1,'1 minute','1 hour','w1'), null, 'service_role', t.csa(1, 'prototype'), 'error:must be running');
select t.adv('a type of another stage is refused', t.running(), null, 'service_role', t.csa(1, 'prd'), 'error:cannot be written in the plan stage');
select t.adv('an intake record cannot be written through it', t.proj('intake')||';insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values ('||t.rid(1)||','||:'P'||',''intake'',''running'',1,now(),''w1'',now())', null, 'service_role', t.csa(1, 'intake_record'), 'error:cannot be written');
select t.adv('a round summary cannot be written through it', t.proj('build_rounds')||';insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values ('||t.rid(1)||','||:'P'||',''build_rounds'',''running'',1,now(),''w1'',now())', null, 'service_role', t.csa(1, 'round_summary'), 'error:cannot be written');
select t.adv('an empty object is refused', t.running(), null, 'service_role', t.csa(1, 'plan', '{}'), 'error:non-empty object');
select t.adv('a list is refused', t.running(), null, 'service_role', t.csa(1, 'plan', '[1]'), 'error:non-empty object');
select t.adv('a null content is refused', t.running(), null, 'service_role', 'select complete_stage_artifact('||:'P'||'::uuid, '||t.rid(1)||', ''w1'', ''plan'', null, ''m'')', 'error:non-empty object');
select t.adv('content that sets model is refused', t.running(), null, 'service_role', t.csa(1, 'plan', '{"model": "x"}'), 'error:cannot set model');
select t.adv('content over 100000 characters is refused', t.running(), null, 'service_role', t.csa(1, 'plan', format('{"body": "%s"}', repeat('x', 100000))), 'error:over 100000');
select t.adv('content just under the cap is kept', t.running(), null, 'service_role', t.csa(1, 'plan', format('{"body": "%s"}', repeat('x', 99900))), 'ok');
select t.adv('a missing model name is refused', t.running(), null, 'service_role', t.csa(1, 'plan', '{"body": "x"}', '  '), 'error:model name');
select t.adv('a model name over 100 characters is refused', t.running(), null, 'service_role', t.csa(1, 'plan', '{"body": "x"}', repeat('m', 101)), 'error:model name');
select t.adv('a refused write changes nothing', t.running()||';'||t.art('plan'), null, 'service_role', t.csa(1, 'plan', '{}'), 'error:non-empty object',
  t.plans()||'=1 and (select status::text from artifacts where project_id='||:'P'||' and type=''plan'')=''draft''');
select t.adv('the prd and prototype types work in their stages too', t.proj('requirements')||';insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values ('||t.rid(1)||','||:'P'||',''requirements'',''running'',1,now(),''w1'',now())', null, 'service_role', t.csa(1, 'prd', t.prd_json(), 'stub', '{"gaps":[],"conflicts":[]}'), 'ok',
  '(select count(*) from artifacts where project_id='||:'P'||' and type=''prd'')=1');

\echo '### stage artifact: which stages queue a run on entry'
select t.adv('the stub stages have an agent', 'select 1', null, current_user, 'select 1', 'ok',
  '(select bool_and(private.stage_has_agent(s)) from unnest(array[''requirements'',''plan'',''prototype'']::public.stage[]) s)');
select t.adv('the other stages have none (build_rounds is run from the console)', 'select 1', null, current_user, 'select 1', 'ok',
  '(select not bool_or(private.stage_has_agent(s)) from unnest(array[''intake'',''build_rounds'',''qc_report'',''deploy_prep'',''handover'',''closed'']::public.stage[]) s)');
