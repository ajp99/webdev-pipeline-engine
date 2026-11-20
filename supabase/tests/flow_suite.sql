-- The whole 2a flow in one project, step by step, each step as the role that does it for real (P2-T22,
-- D-304): the owner creates the project and its intake, the worker claims runs and writes through its
-- two functions, the owner accepts every gate and advances. Model output is stubbed (the review and the
-- stage artifacts are the fixed values the handlers would hand over). Everything rolls back at the end.
-- Loaded after stage_artifact_suite.sql, which defines t.rid and t.is. The worker side of the same flow is
-- apps/worker/src/flow.test.ts (real handlers and runner loop; the queue itself is covered by runner_suite.sql).
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'

-- One statement as a role (the owner is O, the worker is service_role): 'ok' or 'error:<message>'.
create function t.as_(uid uuid, rl text, stmt text) returns text language plpgsql as $$
declare res text := 'ok';
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', rl, true);
  execute format('set local role %I', rl);
  begin
    execute stmt;
  exception when others then
    res := 'error:' || sqlerrm;
  end;
  reset role;
  return res;
end $$;

create function t.pf(name text, cond boolean) returns text language sql as
$$ select case when cond is true then 'PASS      flow: ' || name else 'FAIL      flow: ' || name end $$;
create function t.pfe(name text, got text, want text default null) returns text language sql as
$$ select case when (want is null and got = 'ok') or (want is not null and got like 'error:%' || want || '%')
  then 'PASS      flow: ' || name else 'FAIL      flow: ' || name || ' (got ' || got || ')' end $$;

create function t.flow() returns setof text language plpgsql as $$
declare
  r      text[] := '{}';
  pid    uuid := 'ffffffff-0000-0000-0000-000000000001';
  o      uuid := '00000000-0000-0000-0000-0000000000a0';
  a      uuid := '00000000-0000-0000-0000-0000000000a1';
  rid    uuid;
  art    uuid;
  got    text;
  n      int;
begin
  begin
    -- 1. The owner creates the project and fills in and submits round 1.
    got := t.as_(o, 'authenticated', format($q$insert into projects(id,name,industry,intake_template_snapshot) values (%L,'Acme','generic','{"sections":[]}')$q$, pid));
    r := r || t.pfe('the owner creates the project at the intake stage', got);
    got := t.as_(a, 'authenticated', format($q$insert into projects(name) values ('Rogue')$q$));
    r := r || t.pfe('a user who is not the owner cannot create a project', got, 'row-level security');
    got := t.as_(o, 'authenticated', format($q$insert into intake_rounds(project_id,round) values (%L,1)$q$, pid));
    got := got || t.as_(o, 'authenticated', format($q$insert into intake_responses(project_id,round,question_id,answer,asked_by) values (%L,1,'business_name','"Acme Dental"','template')$q$, pid));
    got := regexp_replace(got, '(ok)+', 'ok');
    r := r || t.pfe('the owner enters the answers', got);
    got := t.as_(o, 'authenticated', format($q$update intake_rounds set status='submitted', submitted_at=now() where project_id=%L and round=1$q$, pid));
    r := r || t.pfe('the owner submits round 1', got);

    -- 2. The review: the owner queues it, the worker claims it and hands in the stubbed review.
    got := t.as_(o, 'authenticated', format($q$select enqueue_run(%L,'intake')$q$, pid));
    r := r || t.pfe('the owner queues the intake review', got);
    r := r || t.pfe('the owner cannot claim the run', t.as_(o, 'authenticated', $q$select * from claim_run('w1')$q$), 'permission denied');
    select id into rid from stage_runs where project_id = pid and stage = 'intake';
    got := t.as_(null, 'service_role', $q$select * from claim_run('w1')$q$);
    r := r || t.pfe('the worker claims it', got);
    r := r || t.pf('the run is running and claimed by w1', (select status = 'running' and claimed_by = 'w1' from stage_runs where id = rid));
    r := r || t.pfe('the owner cannot write the review', t.as_(o, 'authenticated', format($q$select complete_intake_review(%L,1,'s','[]','[]','m')$q$, pid)), 'permission denied');
    got := t.as_(null, 'service_role', format($q$select complete_intake_review(%L,1,'Looks complete.','[]','[]','stub:model')$q$, pid));
    r := r || t.pfe('the worker hands in the review', got);
    got := t.as_(null, 'service_role', format($q$select finish_run(%L,'w1','succeeded',120)$q$, rid));
    r := r || t.pfe('the worker finishes the run', got);
    r := r || t.pf('the intake_record draft exists and the round is reviewed', (select count(*) = 1 from artifacts where project_id = pid and type = 'intake_record' and status = 'draft')
      and (select status = 'reviewed' from intake_rounds where project_id = pid and round = 1));

    -- 3. Accepting the intake gate advances the project and queues the requirements run by itself.
    select id into art from artifacts where project_id = pid and type = 'intake_record';
    r := r || t.pfe('the worker cannot accept a gate', t.as_(null, 'service_role', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)), 'permission denied');
    r := r || t.pfe('the owner cannot move the stage by a direct update', t.as_(o, 'authenticated', format($q$update projects set stage='requirements' where id=%L$q$, pid)), 'only change through advance_stage');
    r := r || t.pf('the stage is still intake after the refused update', (select stage = 'intake' from projects where id = pid));
    r := r || t.pfe('the owner cannot advance without the approval', t.as_(o, 'authenticated', format($q$select advance_stage(%L,'requirements')$q$, pid)), 'advance_stage:');
    r := r || t.pf('the stage is still intake after the refused advance', (select stage = 'intake' from projects where id = pid));
    got := t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art));
    r := r || t.pfe('the owner accepts the intake', got);
    r := r || t.pf('the project is at requirements with a queued requirements run', (select stage = 'requirements' from projects where id = pid)
      and (select count(*) = 1 from stage_runs where project_id = pid and stage = 'requirements' and status = 'queued'));
    r := r || t.pf('an approval record exists for the intake', (select count(*) = 1 from approvals where artifact_id = art));

    -- 4. Requirements: the stub PRD, then the client's sign-off recorded by the owner, then Advance.
    select id into rid from stage_runs where project_id = pid and stage = 'requirements';
    got := t.as_(null, 'service_role', $q$select * from claim_run('w1')$q$);
    r := r || t.pf('the worker holds the requirements run', (select status = 'running' and claimed_by = 'w1' from stage_runs where id = rid));
    r := r || t.pfe('the owner cannot write a stage artifact', t.as_(o, 'authenticated', format($q$select complete_stage_artifact(%L,%L,'w1','prd','{"a":1}','m')$q$, pid, rid)), 'permission denied');
    got := got || t.as_(null, 'service_role', format($q$select complete_stage_artifact(%L,%L,'w1','prd','{"sections":{"business":"b","site_map":"Home; Privacy policy; Cookie notice","features":"Contact form","content":"c","brand":"b","non_functional":"Lighthouse 80+"},"spam_protection":"honeypot","change_summary":""}','stub:template','{"gaps":[],"conflicts":[]}')$q$, pid, rid));
    got := got || t.as_(null, 'service_role', format($q$select finish_run(%L,'w1','succeeded',0)$q$, rid));
    got := regexp_replace(got, '(ok)+', 'ok');
    r := r || t.pfe('the worker claims, writes the PRD and finishes', got);
    select id into art from artifacts where project_id = pid and type = 'prd';
    r := r || t.pfe('the client gate needs an evidence note', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'client',%L)$q$, pid, art)), 'evidence note');
    r := r || t.pfe('the owner records the client sign-off with a note', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'client',%L,'Email from the client, 21 Nov')$q$, pid, art)));
    r := r || t.pf('the project has not advanced by itself (no auto-advance)', (select stage = 'requirements' from projects where id = pid));
    r := r || t.pfe('the owner advances to plan', t.as_(o, 'authenticated', format($q$select advance_stage(%L,'plan')$q$, pid)));
    r := r || t.pf('advancing queued no run', (select count(*) = 0 from stage_runs where project_id = pid and stage = 'plan'));

    -- 5. Plan: the owner presses Run, the worker writes the plan, the owner accepts; the prototype run queues by itself.
    got := t.as_(o, 'authenticated', format($q$select enqueue_run(%L,'plan')$q$, pid));
    r := r || t.pfe('the owner runs the plan stage', got);
    select id into rid from stage_runs where project_id = pid and stage = 'plan';
    got := t.as_(null, 'service_role', $q$select * from claim_run('w1')$q$);
    r := r || t.pf('the worker holds the plan run', (select status = 'running' and claimed_by = 'w1' from stage_runs where id = rid));
    got := got || t.as_(null, 'service_role', format($q$select complete_stage_artifact(%L,%L,'w1','plan','{"stub":true,"sections":[{"title":"Pages","markdown":"One page"}]}','stub:template')$q$, pid, rid));
    got := got || t.as_(null, 'service_role', format($q$select finish_run(%L,'w1','succeeded',0)$q$, rid));
    r := r || t.pfe('the worker writes the plan', regexp_replace(got, '(ok)+', 'ok'));
    select id into art from artifacts where project_id = pid and type = 'plan';
    r := r || t.pfe('the owner accepts the plan', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)));
    r := r || t.pf('the project is at prototype with a queued prototype run', (select stage = 'prototype' from projects where id = pid)
      and (select count(*) = 1 from stage_runs where project_id = pid and stage = 'prototype' and status = 'queued'));

    -- 6. Prototype: owner gate first, then the client's, then Advance to the build stage.
    select id into rid from stage_runs where project_id = pid and stage = 'prototype';
    got := t.as_(null, 'service_role', $q$select * from claim_run('w1')$q$);
    r := r || t.pf('the worker holds the prototype run', (select status = 'running' and claimed_by = 'w1' from stage_runs where id = rid));
    got := got || t.as_(null, 'service_role', format($q$select complete_stage_artifact(%L,%L,'w1','prototype','{"stub":true,"sections":[{"title":"Prototype","markdown":"x"}]}','stub:template')$q$, pid, rid));
    got := got || t.as_(null, 'service_role', format($q$select finish_run(%L,'w1','succeeded',0)$q$, rid));
    r := r || t.pfe('the worker writes the prototype', regexp_replace(got, '(ok)+', 'ok'));
    select id into art from artifacts where project_id = pid and type = 'prototype';
    r := r || t.pfe('the client gate cannot come before the owner gate', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'client',%L,'note')$q$, pid, art)), 'approval must come first');
    r := r || t.pf('the prototype has no approval yet after the refused client gate', (select count(*) = 0 from approvals where artifact_id = art));
    r := r || t.pfe('the owner accepts the prototype', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)));
    r := r || t.pfe('the owner records the client sign-off', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'client',%L,'Call with the client, 22 Nov')$q$, pid, art)));
    r := r || t.pfe('the owner advances to the build stage', t.as_(o, 'authenticated', format($q$select advance_stage(%L,'build_rounds')$q$, pid)));

    -- 7. Build: the owner presses Run, the worker (the Builder runs on the host) finishes the run.
    r := r || t.pfe('the owner runs the build stage', t.as_(o, 'authenticated', format($q$select enqueue_run(%L,'build_rounds')$q$, pid)));
    select id into rid from stage_runs where project_id = pid and stage = 'build_rounds';
    got := t.as_(null, 'service_role', $q$select * from claim_run('w1')$q$);
    r := r || t.pf('the worker holds the build run', (select status = 'running' and claimed_by = 'w1' from stage_runs where id = rid));
    got := got || t.as_(null, 'service_role', format($q$select finish_run(%L,'w1','succeeded',5000)$q$, rid));
    r := r || t.pfe('the worker finishes the build run', regexp_replace(got, '(ok)+', 'ok'));

    -- 8. The record of the whole flow.
    select count(*) into n from stage_runs where project_id = pid and status = 'succeeded';
    r := r || t.pf('five runs succeeded: intake, requirements, plan, prototype, build', n = 5);
    r := r || t.pf('the tokens add up on the runs', (select sum(tokens_used) = 5120 from stage_runs where project_id = pid));
    r := r || t.pf('the artifacts are intake_record, prd, prd_notes, plan, prototype, each version 1',
      (select count(*) = 5 and bool_and(version = 1) from artifacts where project_id = pid));
    r := r || t.pf('every gated artifact has its approval record; the owner-only PRD notes are not gated', not exists (select 1 from artifacts a where a.project_id = pid and a.type <> 'prd_notes' and not exists (select 1 from approvals ap where ap.artifact_id = a.id))
      and (select count(*) = 1 from artifacts where project_id = pid and type = 'prd_notes' and status = 'draft'));
    r := r || t.pf('the PRD and the prototype carry a client approval with its evidence note', (select count(*) = 2 from approvals ap join artifacts ar on ar.id = ap.artifact_id
      where ar.project_id = pid and ap.role = 'client' and ap.evidence_note is not null and ar.type in ('prd', 'prototype')));
    r := r || t.pf('there are five approvals in all: intake, PRD, plan, and the prototype twice', (select count(*) = 5 from approvals ap join artifacts ar on ar.id = ap.artifact_id where ar.project_id = pid));
    r := r || t.pf('the project is at build_rounds and active', (select stage = 'build_rounds' and status = 'active' from projects where id = pid));
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm <> 'T_ROLLBACK' then r := r || ('FAIL      flow: stopped by an error: ' || sqlerrm); end if;
  end;
  return query select unnest(r);
end $$;

-- The follow-up loop: the review asks a question, round 2 opens, the owner answers and submits, the second
-- review closes the loop, and Accept is refused until the latest round is reviewed (D-318).
create function t.flow_followup() returns setof text language plpgsql as $$
declare
  r   text[] := '{}';
  pid uuid := 'ffffffff-0000-0000-0000-000000000002';
  o   uuid := '00000000-0000-0000-0000-0000000000a0';
  art uuid;
begin
  begin
    perform t.as_(o, 'authenticated', format($q$insert into projects(id,name,industry,intake_template_snapshot) values (%L,'Beta','generic','{"sections":[]}')$q$, pid));
    perform t.as_(o, 'authenticated', format($q$insert into intake_rounds(project_id,round) values (%L,1)$q$, pid));
    perform t.as_(o, 'authenticated', format($q$insert into intake_responses(project_id,round,question_id,answer,asked_by) values (%L,1,'goal','"more leads"','template')$q$, pid));
    perform t.as_(o, 'authenticated', format($q$update intake_rounds set status='submitted', submitted_at=now() where project_id=%L and round=1$q$, pid));
    r := r || t.pfe('the review of round 1 asks a follow-up', t.as_(null, 'service_role', format($q$select complete_intake_review(%L,1,'One gap.','[{"issue":"vague goal"}]','[{"id":"fu2_1","text":"Which pages do you need?"}]','stub:model')$q$, pid)));
    r := r || t.pf('round 2 is open with the agent''s question as a row without an answer', (select status = 'open' from intake_rounds where project_id = pid and round = 2)
      and (select count(*) = 1 from intake_responses where project_id = pid and round = 2 and asked_by = 'agent' and answer is null and question = 'Which pages do you need?'));
    select id into art from artifacts where project_id = pid and type = 'intake_record' and version = 1;
    r := r || t.pfe('Accept is refused while the follow-up round is open', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)), 'not reviewed yet');
    perform t.as_(o, 'authenticated', format($q$update intake_responses set answer='"Home and contact"' where project_id=%L and question_id='fu2_1'$q$, pid));
    perform t.as_(o, 'authenticated', format($q$update intake_rounds set status='submitted', submitted_at=now() where project_id=%L and round=2$q$, pid));
    r := r || t.pfe('Accept is still refused while round 2 is submitted but not reviewed', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)), 'not reviewed yet');
    r := r || t.pfe('the worker cannot review round 1 again', t.as_(null, 'service_role', format($q$select complete_intake_review(%L,1,'s','[]','[]','m')$q$, pid)), 'only a submitted round');
    r := r || t.pfe('the second review closes the loop', t.as_(null, 'service_role', format($q$select complete_intake_review(%L,2,'Complete.','[]','[]','stub:model')$q$, pid)));
    select id into art from artifacts where project_id = pid and type = 'intake_record' and version = 2;
    r := r || t.pf('the second review is version 2 and the first stays on record', (select count(*) = 2 from artifacts where project_id = pid and type = 'intake_record'));
    r := r || t.pfe('Accept works once the latest round is reviewed', t.as_(o, 'authenticated', format($q$select accept_gate(%L,'soft',%L)$q$, pid, art)));
    r := r || t.pf('the project is at requirements', (select stage = 'requirements' from projects where id = pid));
    raise exception 'T_ROLLBACK';
  exception when others then
    if sqlerrm <> 'T_ROLLBACK' then r := r || ('FAIL      flow: follow-up loop stopped by an error: ' || sqlerrm); end if;
  end;
  return query select unnest(r);
end $$;

\echo '### the whole flow'
select * from t.flow();
\echo '### the follow-up loop'
select * from t.flow_followup();
