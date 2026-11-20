-- Phase 2b rules (D-324 to D-327): the PRD shape and its owner-only notes, the owner's PRD versions
-- (save_prd_version), artifacts written through the API as drafts, change requests and PRD feedback.
-- Loaded after stage_artifact_suite.sql, which defines t.csa and t.prd_json; t.adv, t.proj, t.art, t.rid
-- come from the earlier suites.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P '''cccccccc-0000-0000-0000-000000000001'''

-- A valid PRD as jsonb, with the summary given; tests change it with jsonb operators.
create function t.prdj(summary text default '') returns jsonb language sql as
$$ select jsonb_set(t.prd_json()::jsonb, '{change_summary}', to_jsonb(summary)) $$;
create function t.notes() returns text language sql as $$ select '{"gaps":[{"issue":"no budget given"}],"conflicts":[]}' $$;
-- A running requirements run 1 claimed by w1, in a project at requirements.
create function t.reqrun() returns text language sql as
$$ select t.proj('requirements')||';insert into stage_runs(id,project_id,stage,status,attempts,heartbeat_at,claimed_by,started_at) values ('
   ||t.rid(1)||',''cccccccc-0000-0000-0000-000000000001'',''requirements'',''running'',1,now(),''w1'',now())' $$;
-- The worker writes a PRD draft with the content and notes given.
create function t.wprd(content jsonb, notes text default null) returns text language sql as
$$ select t.csa(1, 'prd', content::text, 'stub', coalesce(notes, t.notes())) $$;
-- The owner saves a PRD version on top of version base, optionally for a change request.
create function t.save(base int, content jsonb, cr text default null) returns text language sql as
$$ select format('select save_prd_version(%L::uuid, %s, %L::jsonb, %s)', 'cccccccc-0000-0000-0000-000000000001', base, content::text,
   coalesce(format('%L::uuid', cr), 'null')) $$;
-- A change request with a fixed id, inserted as the superuser in the status and decision given.
create function t.cr(id text, st text default 'accepted', choice text default 'accept_current_round', proj text default 'cccccccc-0000-0000-0000-000000000001') returns text language sql as
$$ select format('insert into change_requests(id,project_id,description,status,decision) values (%L,%L,''Add a gallery'',%L,%s)',
   id, proj, st, coalesce(format('%L', choice), 'null')) $$;
create function t.prdv(ver int, st text default 'draft') returns text language sql as
$$ select t.art('prd', ver, st, t.prdj('s')::text) $$;
create function t.decide(choice text, note text default 'Two more days') returns text language sql as
$$ select format('select decide_change_request(%L::uuid, %L, %L)', 'eeeeeeee-0000-0000-0000-000000000001', choice, note) $$;

\echo '### the PRD shape (D-325)'
select t.adv('a valid PRD draft and its notes are written', t.reqrun(), null, 'service_role', t.wprd(t.prdj()), 'ok',
  '(select count(*) from artifacts where project_id='||:'P'||' and type=''prd'' and version=1 and status=''draft'' and created_by is null)=1
   and (select count(*) from artifacts where project_id='||:'P'||' and type=''prd_notes'' and version=1 and status=''draft'' and content->''gaps''->0->>''issue''=''no budget given'')=1');
select t.adv('a missing section is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj() #- '{sections,brand}'), 'error:section brand is missing or empty');
select t.adv('an empty section is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,content}', '"  "')), 'error:section content is missing or empty');
select t.adv('a section that is not a string is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,content}', '["x"]')), 'error:section content is missing or empty');
select t.adv('an unknown section is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,pricing}', '"x"')), 'error:not one of');
select t.adv('an unknown top-level key is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj() || '{"round_plan":"x"}'), 'error:key other than');
select t.adv('a section over 20000 characters is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,brand}', to_jsonb(repeat('x', 20001)))), 'error:over 20000');
select t.adv('a site map without a privacy policy is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,site_map}', '"Home; Cookie notice"')), 'error:privacy policy and a cookie notice');
select t.adv('a site map without a cookie notice is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,site_map}', '"Home; Privacy policy"')), 'error:privacy policy and a cookie notice');
select t.adv('an unknown spam protection is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{spam_protection}', '"captcha"')), 'error:spam_protection must be');
select t.adv('a missing spam protection is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj() - 'spam_protection'), 'error:spam_protection must be');
select t.adv('each spam protection choice is accepted', t.reqrun(), null, 'service_role',
  t.wprd(jsonb_set(t.prdj(), '{spam_protection}', '"turnstile"'))||';'||t.wprd(jsonb_set(t.prdj('v2'), '{spam_protection}', '"no_contact_form"')), 'ok');
select t.adv('a missing change summary is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj() - 'change_summary'), 'error:change_summary must be');
select t.adv('a change summary over 1000 characters is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(repeat('x', 1001))), 'error:change_summary must be');
select t.adv('a second draft needs a change summary', t.reqrun()||';'||t.prdv(1), null, 'service_role', t.wprd(t.prdj()), 'error:needs a summary of what changed');
select t.adv('a second draft with a summary is version 2; the old PRD and notes drafts are superseded', t.reqrun()||';'||t.prdv(1)||';'||t.art('prd_notes'), null, 'service_role', t.wprd(t.prdj('Added a blog')), 'ok',
  t.art_status('prd', 1, 'superseded')||' and '||t.art_status('prd', 2, 'draft')||' and '||t.art_status('prd_notes', 1, 'superseded')||' and '||t.art_status('prd_notes', 2, 'draft'));

\echo '### the owner-only notes (D-325)'
select t.adv('a PRD without notes is refused', t.reqrun(), null, 'service_role', t.csa(1, 'prd', t.prdj()::text, 'stub', null), 'error:the notes must be an object');
select t.adv('notes without a conflicts list are refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[]}'), 'error:need a conflicts list');
select t.adv('notes with another key are refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[],"conflicts":[],"owner_notes":"x"}'), 'error:other than gaps and conflicts');
select t.adv('a note item without an issue is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[{"resolution":"x"}],"conflicts":[]}'), 'error:needs an issue');
select t.adv('a note item with another key is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[{"issue":"x","quote":"y"}],"conflicts":[]}'), 'error:needs an issue');
select t.adv('a resolution must be text', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[],"conflicts":[{"issue":"x","resolution":1}]}'), 'error:needs an issue');
select t.adv('more than 50 gaps are refused', t.reqrun(), null, 'service_role',
  t.wprd(t.prdj(), (select jsonb_build_object('gaps', jsonb_agg(jsonb_build_object('issue', 'g' || i)), 'conflicts', '[]'::jsonb)::text from generate_series(1, 51) i)), 'error:more than 50 gaps');
select t.adv('a plan cannot carry notes', t.running(), null, 'service_role', t.csa(1, 'plan', '{"body":"x"}', 'stub', '{"gaps":[],"conflicts":[]}'), 'error:only a PRD has notes');

\echo '### artifacts through the API are drafts (D-327)'
select t.adv('the owner can insert a draft, and the database records the owner as its author', t.proj('plan'), :'O', 'authenticated',
  format('insert into artifacts(project_id,type,version,status,created_by) values (%L,''plan'',1,''draft'',%L)', 'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1'), 'ok',
  '(select created_by from artifacts where project_id='||:'P'||' and type=''plan'')=''00000000-0000-0000-0000-0000000000a0''::uuid');
select t.adv('the owner cannot insert an approved artifact', t.proj('plan'), :'O', 'authenticated',
  format('insert into artifacts(project_id,type,version,status) values (%L,''plan'',1,''approved'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:written as a draft');
select t.adv('the worker cannot insert an approved artifact', t.proj('plan'), null, 'service_role',
  format('insert into artifacts(project_id,type,version,status) values (%L,''plan'',1,''approved'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:written as a draft');
select t.adv('the worker cannot change an artifact''s status', t.proj('plan')||';'||t.art('plan'), null, 'service_role',
  'update artifacts set status=''superseded'' where project_id='||:'P', 'error:only through the gate functions');
select t.adv('the author of a version cannot be changed', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'update artifacts set created_by='''||:'O'||''' where project_id='||:'P', 'error:immutable');

\echo '### the owner saves a PRD version (P2-T08, D-324)'
select t.adv('the owner saves version 2 on top of version 1; the old draft is superseded', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj('Tightened the goals')), 'ok',
  t.art_status('prd', 1, 'superseded')||' and '||t.art_status('prd', 2, 'draft')||' and (select created_by from artifacts where project_id='||:'P'||' and type=''prd'' and version=2)='''||:'O'||'''::uuid');
select t.adv('the owner can write the first version', t.proj('requirements'), :'O', 'authenticated', t.save(0, t.prdj('First draft by hand')), 'ok', t.art_status('prd', 1, 'draft'));
select t.adv('a stale base version is refused', t.proj('requirements')||';'||t.prdv(1)||';'||t.prdv(2), :'O', 'authenticated', t.save(1, t.prdj('x')), 'error:changed since you opened it (the newest version is 2)');
select t.adv('the owner must write a change summary', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj('  ')), 'error:write a short summary');
select t.adv('an owner version cannot name a model', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj('x') || '{"model":"gpt"}'), 'error:has no model');
select t.adv('the owner''s version must pass the PRD checks', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj('x') #- '{sections,brand}'), 'error:section brand is missing');
select t.adv('a non-owner is refused', t.proj('requirements')||';'||t.prdv(1), :'A', 'authenticated', t.save(1, t.prdj('x')), 'error:not allowed');
select t.adv('the worker cannot call it', t.proj('requirements')||';'||t.prdv(1), null, 'service_role', t.save(1, t.prdj('x')), 'error');
select t.adv('a paused project is refused', t.proj('requirements', 'paused')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj('x')), 'error:must be active');
select t.adv('there is no PRD to save before the requirements stage', t.proj('intake'), :'O', 'authenticated', t.save(0, t.prdj('x')), 'error:no PRD stage yet');
select t.adv('a change request is refused before the sign-off', t.proj('requirements')||';'||t.prdv(1)||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001'), :'O', 'authenticated',
  t.save(1, t.prdj('x'), 'eeeeeeee-0000-0000-0000-000000000001'), 'error:only after the PRD is signed off');
select t.adv('after the sign-off a version needs a change request', t.proj('plan')||';'||t.prdv(1, 'approved'), :'O', 'authenticated', t.save(1, t.prdj('x')), 'error:needs an accepted change request');
select t.adv('an accepted change request allows one approved version tied to it', t.proj('plan')||';'||t.prdv(1, 'approved')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001'), :'O', 'authenticated',
  t.save(1, t.prdj('Gallery page added'), 'eeeeeeee-0000-0000-0000-000000000001'), 'ok',
  t.art_status('prd', 1, 'approved')||' and '||t.art_status('prd', 2, 'approved')||' and (select change_request_id from artifacts where project_id='||:'P'||' and type=''prd'' and version=2)=''eeeeeeee-0000-0000-0000-000000000001''::uuid');
select t.adv('a change request gets only one PRD version', t.proj('plan')||';'||t.prdv(1, 'approved')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001')
  ||';insert into artifacts(project_id,type,version,status,content,change_request_id) values (''cccccccc-0000-0000-0000-000000000001'',''prd'',2,''approved'',''{}'',''eeeeeeee-0000-0000-0000-000000000001'')', :'O', 'authenticated',
  t.save(2, t.prdj('again'), 'eeeeeeee-0000-0000-0000-000000000001'), 'error:already has its PRD version');
select t.adv('a deferred change request allows no version', t.proj('plan')||';'||t.prdv(1, 'approved')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'deferred', 'defer'), :'O', 'authenticated',
  t.save(1, t.prdj('x'), 'eeeeeeee-0000-0000-0000-000000000001'), 'error:must be accepted');
select t.adv('another project''s change request is refused', t.proj('plan')||';'||t.prdv(1, 'approved')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', proj => '11111111-1111-1111-1111-111111111111'), :'O', 'authenticated',
  t.save(1, t.prdj('x'), 'eeeeeeee-0000-0000-0000-000000000001'), 'error:not found for this project');

\echo '### change requests (P2-T10, D-326)'
select t.adv('the owner records a request after the sign-off; it is received and the owner is its author', t.proj('plan'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description,affected_pages,affected_features) values (%L,''Add a gallery'',''{Gallery}'',''{Lightbox}'')', 'cccccccc-0000-0000-0000-000000000001'), 'ok',
  '(select status::text||created_by::text from change_requests where project_id='||:'P'||')=''received'||'00000000-0000-0000-0000-0000000000a0''');
select t.adv('no request before the sign-off', t.proj('requirements'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description) values (%L,''x'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:start after the PRD sign-off');
select t.adv('no request once changes are frozen', t.proj('build_rounds')||';update projects set changes_frozen_at=now() where id='||:'P', :'O', 'authenticated',
  format('insert into change_requests(project_id,description) values (%L,''x'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:frozen');
select t.adv('no request for a paused project', t.proj('plan', 'paused'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description) values (%L,''x'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:only for an active project');
select t.adv('a new request cannot come decided', t.proj('plan'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description,status,decision) values (%L,''x'',''accepted'',''accept_current_round'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:received and undecided');
select t.adv('a request needs a description', t.proj('plan'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description) values (%L,'' '')', 'cccccccc-0000-0000-0000-000000000001'), 'error:needs a description');
select t.adv('the owner can correct a received request', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated',
  'update change_requests set description=''Add a photo gallery'', affected_pages=''{Gallery}'' where project_id='||:'P', 'ok');
select t.adv('a request cannot be deleted', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated',
  'delete from change_requests where project_id='||:'P', 'error:decline it instead');
select t.adv('accepting sets the status, the note, the time and the owner', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('accept_current_round'), 'ok',
  '(select status::text||decision::text||impact_note||decided_by::text from change_requests where project_id='||:'P'||' and decided_at is not null)=''acceptedaccept_current_roundTwo more days00000000-0000-0000-0000-0000000000a0''');
select t.adv('deferring sets deferred', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('defer'), 'ok',
  '(select status::text from change_requests where project_id='||:'P'||')=''deferred''');
select t.adv('declining sets declined, even once changes are frozen', t.proj('build_rounds')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null)||';update projects set changes_frozen_at=now() where id='||:'P', :'O', 'authenticated', t.decide('decline'), 'ok',
  '(select status::text from change_requests where project_id='||:'P'||')=''declined''');
select t.adv('accepting is refused once changes are frozen', t.proj('build_rounds')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null)||';update projects set changes_frozen_at=now() where id='||:'P', :'O', 'authenticated', t.decide('accept_current_round'), 'error:frozen');
select t.adv('a mini-round decision waits for go-live', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('accept_mini_round'), 'error:until go-live');
select t.adv('a decision needs an impact note', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('defer', ' '), 'error:write the impact note');
select t.adv('a decided request cannot be decided again', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'declined', 'decline'), :'O', 'authenticated', t.decide('accept_current_round'), 'error:already declined');
select t.adv('a decided request cannot be edited', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'declined', 'decline'), :'O', 'authenticated',
  'update change_requests set description=''y'' where project_id='||:'P', 'error:cannot be edited');
select t.adv('a non-owner cannot decide', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'A', 'authenticated', t.decide('decline'), 'error:not allowed');
select t.adv('the worker cannot decide', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), null, 'service_role', t.decide('decline'), 'error');
select t.adv('a paused project''s request cannot be decided', t.proj('plan', 'paused')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('decline'), 'error:must be active');

\echo '### PRD feedback (P2-T09)'
select t.adv('the owner records the client''s Request changes on a PRD version; the owner is its author', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated',
  format('insert into prd_feedback(project_id,artifact_id,body,created_by) select %L,id,''Please add opening hours'',%L from artifacts where project_id=%L and type=''prd''',
    'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001'), 'ok',
  '(select created_by from prd_feedback where project_id='||:'P'||')='''||:'O'||'''::uuid');
select t.adv('feedback must name a PRD, not another artifact', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  format('insert into prd_feedback(project_id,artifact_id,body,created_by) select %L,id,''x'',%L from artifacts where project_id=%L', 'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'cccccccc-0000-0000-0000-000000000001'), 'error:must name a PRD version');
select t.adv('feedback needs a note', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated',
  format('insert into prd_feedback(project_id,artifact_id,body,created_by) select %L,id,'' '',%L from artifacts where project_id=%L', 'cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'cccccccc-0000-0000-0000-000000000001'), 'error:needs a note');

\echo '### independent review fixes (Phase 2b migration)'
select t.adv('the owner cannot insert a PRD directly; only save_prd_version writes one', t.proj('requirements'), :'O', 'authenticated',
  format('insert into artifacts(project_id,type,version,content) values (%L,''prd'',1,''{"x":1}'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:written only through');
select t.adv('the worker cannot insert a PRD directly; only complete_stage_artifact writes one', t.proj('requirements'), null, 'service_role',
  format('insert into artifacts(project_id,type,version,content) values (%L,''prd'',1,''{"x":1}'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:written only through');
select t.adv('the owner cannot insert PRD notes directly', t.proj('requirements'), :'O', 'authenticated',
  format('insert into artifacts(project_id,type,version,content) values (%L,''prd_notes'',1,''{"gaps":[],"conflicts":[]}'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:written only through');
select t.adv('the change request a version names cannot be changed', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001')||';'||t.art('plan')
  ||';update artifacts set change_request_id=''eeeeeeee-0000-0000-0000-000000000001'' where project_id='||:'P', :'O', 'authenticated',
  'update artifacts set change_request_id=null where project_id='||:'P', 'error:immutable');
select t.adv('the owner cannot delete an artifact version', t.proj('plan')||';'||t.art('plan'), :'O', 'authenticated',
  'delete from artifacts where project_id='||:'P', 'error:is kept');
select t.adv('the worker cannot delete an artifact version', t.proj('plan')||';'||t.art('plan'), null, 'service_role',
  'delete from artifacts where project_id='||:'P', 'error:is kept');
select t.adv('a project''s own cascade still removes its artifacts', t.proj('plan')||';'||t.art('plan'), null, 'postgres',
  'delete from projects where id='||:'P', 'ok', '(select count(*) from artifacts where project_id='||:'P'||')=0');
select t.adv('a signed-off PRD cannot be replaced in the requirements stage', t.proj('requirements')||';'||t.prdv(1, 'approved'), :'O', 'authenticated', t.save(1, t.prdj('x')), 'error:newest PRD is signed off');
select t.adv('a section of only newlines and tabs is refused', t.reqrun(), null, 'service_role', t.wprd(jsonb_set(t.prdj(), '{sections,brand}', to_jsonb(E'\n\t'::text))), 'error:section brand is missing or empty');
select t.adv('an owner summary of only a newline is refused', t.proj('requirements')||';'||t.prdv(1), :'O', 'authenticated', t.save(1, t.prdj(E'\n')), 'error:write a short summary');
select t.adv('a note issue of only whitespace is refused', t.reqrun(), null, 'service_role', t.wprd(t.prdj(), '{"gaps":[{"issue":"\n\t"}],"conflicts":[]}'), 'error:needs an issue');
select t.adv('a change request description of only whitespace is refused', t.proj('plan'), :'O', 'authenticated',
  format('insert into change_requests(project_id,description) values (%L,E''\n\t'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:needs a description');
select t.adv('an impact note of only whitespace is refused', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), :'O', 'authenticated', t.decide('defer', E'\n'), 'error:write the impact note');
select t.adv('the worker cannot record a change request', t.proj('plan'), null, 'service_role',
  format('insert into change_requests(project_id,description) values (%L,''x'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:only the owner');
select t.adv('the worker cannot correct a change request', t.proj('plan')||';'||t.cr('eeeeeeee-0000-0000-0000-000000000001', 'received', null), null, 'service_role',
  'update change_requests set description=''y'' where project_id='||:'P', 'error:only the owner');
select t.adv('PRD feedback keeps its author when its note is corrected', t.proj('requirements')||';'||t.prdv(1)
  ||';insert into prd_feedback(project_id,artifact_id,body,created_by) select project_id,id,''x'',''00000000-0000-0000-0000-0000000000a0'' from artifacts where project_id='||:'P', :'O', 'authenticated',
  'update prd_feedback set body=''Please add hours'' where project_id='||:'P', 'ok', '(select body from prd_feedback where project_id='||:'P'||')=''Please add hours''');
select t.adv('PRD feedback cannot be moved or re-authored', t.proj('requirements')||';'||t.prdv(1)
  ||';insert into prd_feedback(project_id,artifact_id,body,created_by) select project_id,id,''x'',''00000000-0000-0000-0000-0000000000a0'' from artifacts where project_id='||:'P', :'A', 'authenticated',
  'update prd_feedback set created_by='''||:'A'||''' where project_id='||:'P', 'ok', '(select created_by from prd_feedback where project_id='||:'P'||')='''||:'O'||'''::uuid');
select t.adv('the owner cannot re-author PRD feedback', t.proj('requirements')||';'||t.prdv(1)
  ||';insert into prd_feedback(project_id,artifact_id,body,created_by) select project_id,id,''x'',''00000000-0000-0000-0000-0000000000a0'' from artifacts where project_id='||:'P', :'O', 'authenticated',
  'update prd_feedback set created_by='''||:'A'||''' where project_id='||:'P', 'error:only have its note corrected');
