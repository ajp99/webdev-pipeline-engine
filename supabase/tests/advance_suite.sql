-- advance_stage() checks (P1-T07, migration 0002). Loaded after the migrations and fixtures.
-- t.adv(name, setup, uid, role, call, expect, check)
--   setup   SQL run as the superuser inside a savepoint that is always rolled back
--   call    SQL run as the given Supabase role
--   expect  'ok', 'error' or 'error:<text in the message>'
--   check   optional SQL boolean, evaluated as the superuser after a successful call
create function t.adv(name text, setup text, uid uuid, rl text, call text, expect text, chk text default null)
returns text language plpgsql as $$
declare res text := 'ok'; okv boolean;
begin
  begin
    execute setup;
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    perform set_config('request.jwt.claim.role', rl, true);
    execute format('set local role %I', rl);
    begin
      execute call;
    exception when others then
      res := 'error:' || sqlerrm;
    end;
    reset role;
    if res = 'ok' and chk is not null then
      execute 'select (' || chk || ')' into okv;
      if okv is not true then res := 'check failed: ' || chk; end if;
    end if;
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm <> 'T_ROLLBACK' then res := 'error:' || sqlerrm; end if;
  end;
  return case
    when expect = 'ok' and res = 'ok' then 'PASS      ' || name
    when expect = 'error' and res like 'error:%' then 'PASS      ' || name
    when expect like 'error:%' and res like '%' || substr(expect, 7) || '%' then 'PASS      ' || name
    else 'FAIL      ' || name || ' (expected ' || expect || ', got ' || res || ')' end;
end $$;

-- Setup builders. One scratch project, id C, in the stage and status given.
create function t.proj(stg text, st text default 'active') returns text language sql as
$$ select format('insert into projects(id,name,stage,status) values (%L,%L,%L,%L)',
  'cccccccc-0000-0000-0000-000000000001','C',stg,st) $$;
create function t.art(typ text, ver int default 1, st text default 'draft') returns text language sql as
$$ select format('insert into artifacts(project_id,type,version,status) values (%L,%L,%s,%L)',
  'cccccccc-0000-0000-0000-000000000001',typ,ver,st) $$;
-- An approval by the owner (role owner) or the client (role client) at a fixed time offset (minutes).
create function t.appr(typ text, ver int, gate text, mins int default 0) returns text language sql as
$$ select format('insert into approvals(artifact_id,approved_by,role,gate_type,at)
  select id,%L,%L,%L,timestamptz ''2026-01-01 10:00'' + interval ''%s minutes''
  from artifacts where project_id=%L and type=%L and version=%s',
  case when gate='client' then '00000000-0000-0000-0000-0000000000a1' else '00000000-0000-0000-0000-0000000000a0' end,
  case when gate='client' then 'client' else 'owner' end, gate, mins,
  'cccccccc-0000-0000-0000-000000000001', typ, ver) $$;
create function t.rnd(n int, st text, cr boolean default false) returns text language sql as
$$ select format('insert into rounds(project_id,number,status,change_request_id) values (%L,%s,%L,%s)',
  'cccccccc-0000-0000-0000-000000000001', n, st,
  case when cr then '(select id from change_requests limit 1)' else 'null' end) $$;
create function t.go(nxt text) returns text language sql as
$$ select format('select advance_stage(%L,%L)','cccccccc-0000-0000-0000-000000000001',nxt) $$;
create function t.cs() returns text language sql as
$$ select 'select stage::text from projects where id=''cccccccc-0000-0000-0000-000000000001''' $$;

\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'

\echo '### advance_stage'
-- rules common to every stage
select t.adv('no artifact at all: intake cannot advance', t.proj('intake'), :'O', 'authenticated', t.go('requirements'), 'error:intake_record');
select t.adv('intake advances with an owner soft approval', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), :'O', 'authenticated', t.go('requirements'), 'ok', '(' || t.cs() || ') = ''requirements''');
select t.adv('the worker (service role) may advance too', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), null, 'service_role', t.go('requirements'), 'ok');
select t.adv('a client cannot call advance_stage', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), :'A', 'authenticated', t.go('requirements'), 'error:not allowed');
select t.adv('skipping a stage is refused', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), :'O', 'authenticated', t.go('plan'), 'error:is not the stage after');
select t.adv('going backwards is refused', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.go('requirements'), 'error:is not the stage after');
select t.adv('a paused project cannot advance', t.proj('intake','paused')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), :'O', 'authenticated', t.go('requirements'), 'error:paused');
select t.adv('a closed project cannot advance', t.proj('closed','closed'), :'O', 'authenticated', t.go('closed'), 'error:closed');
select t.adv('an unknown project is refused', 'select 1', :'O', 'authenticated', t.go('requirements'), 'error:not found');
select t.adv('an approval on the wrong artifact type does not count', t.proj('plan')||';'||t.art('prd')||';'||t.appr('prd',1,'soft')||';'||t.art('plan'), :'O', 'authenticated', t.go('prototype'), 'error:soft approval');
select t.adv('an approval on a superseded version does not count', t.proj('plan')||';'||t.art('plan',1,'superseded')||';'||t.appr('plan',1,'soft')||';'||t.art('plan',2), :'O', 'authenticated', t.go('prototype'), 'error:soft approval');
select t.adv('a superseded newest artifact does not count', t.proj('plan')||';'||t.art('plan',1,'superseded')||';'||t.appr('plan',1,'soft'), :'O', 'authenticated', t.go('prototype'), 'error');
select t.adv('the stage trigger still blocks a direct update after an advance', t.proj('intake')||';'||t.art('intake_record')||';'||t.appr('intake_record',1,'soft'), :'O', 'authenticated', t.go('requirements')||'; update projects set stage=''plan'' where id=''cccccccc-0000-0000-0000-000000000001''', 'error:advance_stage');

-- requirements: the client gate
select t.adv('requirements: an owner approval is not enough', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'soft'), :'O', 'authenticated', t.go('plan'), 'error:client approval');
select t.adv('requirements: the client sign-off advances', t.proj('requirements')||';'||t.art('prd')||';'||t.appr('prd',1,'client'), :'O', 'authenticated', t.go('plan'), 'ok', '(' || t.cs() || ') = ''plan''');

-- prototype: two approvals, owner first and then client, on the same version
select t.adv('prototype: owner approval only is refused', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft'), :'O', 'authenticated', t.go('build_rounds'), 'error:client approval');
select t.adv('prototype: client approval only is refused', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'client'), :'O', 'authenticated', t.go('build_rounds'), 'error:soft approval');
select t.adv('prototype: owner then client advances', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft',0)||';'||t.appr('prototype',1,'client',5), :'O', 'authenticated', t.go('build_rounds'), 'ok', '(' || t.cs() || ') = ''build_rounds''');
select t.adv('prototype: client before owner is refused', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'client',0)||';'||t.appr('prototype',1,'soft',5), :'O', 'authenticated', t.go('build_rounds'), 'error:must come after');
select t.adv('prototype: approvals spread over two versions are refused', t.proj('prototype')||';'||t.art('prototype',1,'superseded')||';'||t.appr('prototype',1,'soft',0)||';'||t.art('prototype',2)||';'||t.appr('prototype',2,'client',5), :'O', 'authenticated', t.go('build_rounds'), 'error:soft approval');

-- project overrides of gate_config
select t.adv('override: a project gate added on top is required', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated', t.go('prototype'), 'error:hard approval');
select t.adv('override: with both approvals it advances', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft')||';'||t.appr('plan',1,'hard')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''cccccccc-0000-0000-0000-000000000001'',''hard'',''owner'')', :'O', 'authenticated', t.go('prototype'), 'ok');
select t.adv('override: a changed deadline does not drop the global gate', t.proj('prototype')||';'||t.art('prototype')||';'||t.appr('prototype',1,'soft')||';insert into gate_config(stage,project_id,gate_type,gatekeeper,escalate_after_hours) values (''prototype'',''cccccccc-0000-0000-0000-000000000001'',''soft'',''owner'',48)', :'O', 'authenticated', t.go('build_rounds'), 'error:client approval');
select t.adv('another project''s override is ignored', t.proj('plan')||';'||t.art('plan')||';'||t.appr('plan',1,'soft')||';insert into gate_config(stage,project_id,gate_type,gatekeeper) values (''plan'',''11111111-1111-1111-1111-111111111111'',''hard'',''owner'')', :'O', 'authenticated', t.go('prototype'), 'ok');

-- build rounds
select t.adv('rounds: none planned is refused', t.proj('build_rounds'), :'O', 'authenticated', t.go('qc_report'), 'error:build round');
select t.adv('rounds: one still in review is refused', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.art('round_summary',1)||';'||t.appr('round_summary',1,'soft')||';'||t.rnd(2,'in_review'), :'O', 'authenticated', t.go('qc_report'), 'error:build round');
select t.adv('rounds: an approved round without an approval record is refused', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.art('round_summary',1), :'O', 'authenticated', t.go('qc_report'), 'error:build round');
select t.adv('rounds: an approval on a superseded round summary does not count', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.art('round_summary',1,'superseded')||';'||t.appr('round_summary',1,'soft'), :'O', 'authenticated', t.go('qc_report'), 'error:build round');
select t.adv('rounds: all approved with records advances', t.proj('build_rounds')||';'||t.rnd(1,'approved')||';'||t.art('round_summary',1)||';'||t.appr('round_summary',1,'soft')||';'||t.rnd(2,'approved')||';'||t.art('round_summary',2)||';'||t.appr('round_summary',2,'soft'), :'O', 'authenticated', t.go('qc_report'), 'ok', '(' || t.cs() || ') = ''qc_report''');
select t.adv('rounds: a change-request round is ignored', t.proj('build_rounds')||';insert into change_requests(id,project_id,description,submitted_by) values (''dddddddd-0000-0000-0000-000000000001'',''cccccccc-0000-0000-0000-000000000001'',''cr'',''owner'')'||';'||t.rnd(1,'approved')||';'||t.art('round_summary',1)||';'||t.appr('round_summary',1,'soft')||';insert into rounds(project_id,number,status,change_request_id) values (''cccccccc-0000-0000-0000-000000000001'',2,''planned'',''dddddddd-0000-0000-0000-000000000001'')', :'O', 'authenticated', t.go('qc_report'), 'ok');

-- later stages
select t.adv('qc_report: report approval advances', t.proj('qc_report')||';'||t.art('report')||';'||t.appr('report',1,'soft'), :'O', 'authenticated', t.go('deploy_prep'), 'ok');
select t.adv('deploy_prep: a hard approval on the checklist advances', t.proj('deploy_prep')||';'||t.art('deployment_checklist')||';'||t.appr('deployment_checklist',1,'hard'), :'O', 'authenticated', t.go('handover'), 'ok');
select t.adv('deploy_prep: a soft approval is not enough', t.proj('deploy_prep')||';'||t.art('deployment_checklist')||';'||t.appr('deployment_checklist',1,'soft'), :'O', 'authenticated', t.go('handover'), 'error:hard approval');

-- close (D-220) and releases (D-223)
select t.adv('handover: closes stage, status and reason together', t.proj('handover')||';'||t.art('handover_guide')||';'||t.appr('handover_guide',1,'hard'), :'O', 'authenticated', t.go('closed'), 'ok',
  '(select stage::text||status::text||close_reason::text from projects where id=''cccccccc-0000-0000-0000-000000000001'') = ''closedclosedcompleted''');
select t.adv('handover: a release-note approval cannot close the project', t.proj('handover')||';'||t.art('release_note')||';'||t.appr('release_note',1,'hard'), :'O', 'authenticated', t.go('closed'), 'error:handover_guide');
select t.adv('handover: a release note does not stand in for the guide', t.proj('handover')||';'||t.art('handover_guide')||';'||t.art('release_note')||';'||t.appr('release_note',1,'hard'), :'O', 'authenticated', t.go('closed'), 'error:hard approval');
select t.adv('a release-note approval cannot advance any other stage', t.proj('deploy_prep')||';'||t.art('release_note')||';'||t.appr('release_note',1,'hard'), :'O', 'authenticated', t.go('handover'), 'error:deployment_checklist');
