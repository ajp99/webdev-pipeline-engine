-- The intake review function (P2-T05, D-006, D-077, D-079): complete_intake_review. Loaded after
-- runner_suite.sql, which defines t.adv, t.proj and the scratch project P.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set P '''cccccccc-0000-0000-0000-000000000001'''

-- Round r of the scratch project with status st.
create function t.ir(r int, st text) returns text language sql as
$$ select format('insert into intake_rounds(project_id,round,status) values (%L,%s,%L)', 'cccccccc-0000-0000-0000-000000000001', r, st) $$;
-- One follow-up with id fu<r>_<n>.
create function t.fu(r int, n int) returns text language sql as
$$ select format('{"id": "fu%s_%s", "text": "Which pages do you need?"}', r, n) $$;
-- The call: a review of round r with the given follow-ups (json list text) and gaps.
create function t.cir(r int, followups text default '[]', gaps text default '[]', summary text default 'ok') returns text language sql as
$$ select format('select complete_intake_review(%L::uuid, %s, %L, %L::jsonb, %L::jsonb, ''gemini-2.5-flash'')',
  'cccccccc-0000-0000-0000-000000000001', r, summary, gaps, followups) $$;
-- Builds a project at intake with round r submitted (earlier rounds reviewed).
create function t.setup(r int) returns text language sql as
$$ select t.proj('intake') || ';' || (select string_agg(t.ir(i, case when i < r then 'reviewed' else 'submitted' end), ';' order by i) from generate_series(1, r) i) $$;

\echo '### intake review: complete_intake_review'
select t.adv('the worker reviews a submitted round: the round is locked', t.setup(1), null, 'service_role', t.cir(1, '['||t.fu(2,1)||']'), 'ok',
  '(select status from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=1)=''reviewed'' and (select reviewed_at from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=1) is not null');
select t.adv('follow-ups open the next round for the owner', t.setup(1), null, 'service_role', t.cir(1, '['||t.fu(2,1)||']'), 'ok',
  '(select status from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=2)=''open''');
select t.adv('no follow-ups: no next round opens', t.setup(1), null, 'service_role', t.cir(1), 'ok',
  '(select count(*) from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'')=1');
select t.adv('the review is stored as an intake_record draft with the round, summary, gaps and follow-ups', t.setup(1), null, 'service_role',
  t.cir(1, '['||t.fu(2,1)||']', '[{"issue": "vague goal"}]', 'Needs goals'), 'ok',
  '(select count(*) from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''intake_record'' and version=1 and status=''draft'' and content->>''round''=''1'' and content->>''summary''=''Needs goals'' and jsonb_array_length(content->''gaps'')=1 and jsonb_array_length(content->''followups'')=1 and content->>''model''=''gemini-2.5-flash'' and content->''capped''=''false''::jsonb)=1');
select t.adv('the next review gets the next artifact version', t.setup(2)||';'||t.art('intake_record', 1), null, 'service_role', t.cir(2), 'ok',
  '(select max(version) from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''intake_record'')=2');

\echo '### intake review: who and when'
select t.adv('the owner session cannot call it', t.setup(1), :'O', 'authenticated', t.cir(1), 'error');
select t.adv('a user who is not the owner cannot call it', t.setup(1), :'A', 'authenticated', t.cir(1), 'error');
select t.adv('it refuses the owner session even if the grant were widened', t.setup(1)||';grant execute on function complete_intake_review(uuid,int,text,jsonb,jsonb,text) to authenticated', :'O', 'authenticated', t.cir(1), 'error:not allowed');
select t.adv('it refuses a user who is not the owner even if the grant were widened', t.setup(1)||';grant execute on function complete_intake_review(uuid,int,text,jsonb,jsonb,text) to authenticated', :'A', 'authenticated', t.cir(1), 'error:not allowed');
select t.adv('anon cannot call it', t.setup(1), null, 'anon', t.cir(1), 'error');
select t.adv('an unknown project is refused', 'select 1', null, 'service_role', 'select complete_intake_review(''eeeeeeee-0000-0000-0000-000000000001'', 1, ''s'', ''[]'', ''[]'', null)', 'error:project not found');
select t.adv('a paused project is refused', t.proj('intake','paused')||';'||t.ir(1,'submitted'), null, 'service_role', t.cir(1), 'error:active and at the intake stage');
select t.adv('a project past intake is refused', t.proj('requirements')||';'||t.ir(1,'submitted'), null, 'service_role', t.cir(1), 'error:active and at the intake stage');
select t.adv('a round that does not exist is refused', t.proj('intake'), null, 'service_role', t.cir(1), 'error:round 1 not found');
select t.adv('an open round is not reviewed', t.proj('intake')||';'||t.ir(1,'open'), null, 'service_role', t.cir(1), 'error:only a submitted round');
select t.adv('a reviewed round is not reviewed twice', t.proj('intake')||';'||t.ir(1,'reviewed'), null, 'service_role', t.cir(1), 'error:only a submitted round');
select t.adv('only the latest round is reviewed', t.proj('intake')||';'||t.ir(1,'submitted')||';'||t.ir(2,'open'), null, 'service_role', t.cir(1), 'error:only the latest round');
select t.adv('a refused review changes nothing', t.proj('intake')||';'||t.ir(1,'open'), null, 'service_role', t.cir(1, '['||t.fu(2,1)||']')||'', 'error:only a submitted round',
  '(select count(*) from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''intake_record'')=0 and (select count(*) from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'')=1');

\echo '### intake review: caps and shape'
select t.adv('eight follow-ups are fine', t.setup(1), null, 'service_role',
  t.cir(1, '['||(select string_agg(t.fu(2,i), ',') from generate_series(1,8) i)||']'), 'ok');
select t.adv('nine follow-ups are refused (D-077)', t.setup(1), null, 'service_role',
  t.cir(1, '['||(select string_agg(t.fu(2,i), ',') from generate_series(1,9) i)||']'), 'error:at most 8');
select t.adv('round 3 can still ask for follow-ups: the 3rd follow-up round opens', t.setup(3), null, 'service_role', t.cir(3, '['||t.fu(4,1)||']'), 'ok',
  '(select status from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=4)=''open''');
select t.adv('round 4 is the last: no more follow-ups (D-006)', t.setup(4), null, 'service_role', t.cir(4, '['||t.fu(5,1)||']'), 'error:cap of 3 follow-up rounds');
select t.adv('round 4 is reviewed with gaps for the owner, and no round 5 opens', t.setup(4), null, 'service_role', t.cir(4, '[]', '[{"issue": "still vague"}]'), 'ok',
  '(select count(*) from intake_rounds where project_id=''cccccccc-0000-0000-0000-000000000001'')=4 and (select content->''capped'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''intake_record'')=''true''::jsonb');
select t.adv('a follow-up needs text', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": "  "}]'), 'error:needs text');
select t.adv('a follow-up needs an id for the next round', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu1_1", "text": "Q?"}]'), 'error:needs text and an id');
select t.adv('a follow-up id must look like fu<round>_<n>', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "q1", "text": "Q?"}]'), 'error:needs text and an id');
select t.adv('follow-up ids must be unique', t.setup(1), null, 'service_role', t.cir(1, '['||t.fu(2,1)||','||t.fu(2,1)||']'), 'error:must be unique');
select t.adv('a follow-up must be an object', t.setup(1), null, 'service_role', t.cir(1, '["Which pages?"]'), 'error:needs text and an id');
select t.adv('the review needs a summary', t.setup(1), null, 'service_role', t.cir(1, '[]', '[]', '  '), 'error:needs a summary');
select t.adv('gaps must be a list', t.setup(1), null, 'service_role', t.cir(1, '[]', '{"a": 1}'), 'error:gaps must be a list');
select t.adv('follow-ups must be a list', t.setup(1), null, 'service_role', t.cir(1, '{"a": 1}'), 'error:follow-ups must be a list');

-- The reviewer's findings: what lands in an immutable row is checked element by element and bounded.
select t.adv('a missing summary (null) is refused', t.setup(1), null, 'service_role', t.cir(1, '[]', '[]', null), 'error:needs a summary');
select t.adv('missing gaps (null) are refused', t.setup(1), null, 'service_role', t.cir(1, '[]', null), 'error:gaps must be a list');
select t.adv('missing follow-ups (null) are refused', t.setup(1), null, 'service_role', t.cir(1, null), 'error:follow-ups must be a list');
select t.adv('a gap must be an object', t.setup(1), null, 'service_role', t.cir(1, '[]', '[1, "x"]'), 'error:each gap');
select t.adv('a gap needs a text issue', t.setup(1), null, 'service_role', t.cir(1, '[]', '[{"issue": 5}]'), 'error:each gap');
select t.adv('a gap may not carry other keys', t.setup(1), null, 'service_role', t.cir(1, '[]', '[{"issue": "x", "evil": 1}]'), 'error:each gap');
select t.adv('a gap question id must be text', t.setup(1), null, 'service_role', t.cir(1, '[]', '[{"issue": "x", "question_id": 7}]'), 'error:each gap');
select t.adv('a gap may name its question', t.setup(1), null, 'service_role', t.cir(1, '[]', '[{"issue": "x", "question_id": "site_goal"}]'), 'ok');
select t.adv('at most 40 gaps', t.setup(1), null, 'service_role',
  t.cir(1, '[]', (select jsonb_agg(jsonb_build_object('issue', 'g' || i))::text from generate_series(1, 41) i)), 'error:at most 40 gaps');
select t.adv('a follow-up text must be a string', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": 123}]'), 'error:needs text');
select t.adv('a follow-up may not carry other keys', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": "Q?", "evil": 1}]'), 'error:needs text');
select t.adv('a follow-up reason must be a string', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": "Q?", "reason": ["x"]}]'), 'error:needs text');
select t.adv('a follow-up text is at most 500 characters', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": "' || repeat('x', 501) || '"}]'), 'error:needs text');
select t.adv('a follow-up text of 500 characters is fine', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_1", "text": "' || repeat('x', 500) || '"}]'), 'ok');
select t.adv('the summary is at most 1500 characters', t.setup(1), null, 'service_role', t.cir(1, '[]', '[]', repeat('x', 1501)), 'error:too long');
select t.adv('a summary of 1500 characters is fine', t.setup(1), null, 'service_role', t.cir(1, '[]', '[]', repeat('x', 1500)), 'ok');
select t.adv('a gap issue is at most 1100 characters', t.setup(1), null, 'service_role', t.cir(1, '[]', '[{"issue": "' || repeat('x', 1101) || '"}]'), 'error:each gap');
select t.adv('follow-up ids start at 1', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_0", "text": "Q?"}]'), 'error:needs text and an id');
select t.adv('follow-up ids have no leading zero', t.setup(1), null, 'service_role', t.cir(1, '[{"id": "fu2_01", "text": "Q?"}]'), 'error:needs text and an id');
select t.adv('follow-up ids run from 1 to n without a gap', t.setup(1), null, 'service_role', t.cir(1, '[' || t.fu(2, 1) || ',' || t.fu(2, 3) || ']'), 'error:must run from');
select t.adv('follow-up ids may come in any order', t.setup(1), null, 'service_role', t.cir(1, '[' || t.fu(2, 2) || ',' || t.fu(2, 1) || ']'), 'ok');
select t.adv('a review before the last round is not marked capped', t.setup(2), null, 'service_role', t.cir(2, '[' || t.fu(3, 1) || ']'), 'ok',
  '(select content->''capped'' from artifacts where project_id=''cccccccc-0000-0000-0000-000000000001'' and type=''intake_record'')=''false''::jsonb');

\echo '### follow-up questions are rows (P2-T06)'
select t.adv('each follow-up becomes a row of the next round with its text and no answer', t.setup(1), null, 'service_role',
  t.cir(1, '['||t.fu(2,1)||','||t.fu(2,2)||']'), 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=2 and asked_by=''agent'' and answer is null and question=''Which pages do you need?'' and question_id in (''fu2_1'',''fu2_2''))=2');
select t.adv('no follow-ups, no rows', t.setup(1), null, 'service_role', t.cir(1), 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'')=0');
select t.adv('a refused review leaves no question rows', t.setup(1), null, 'service_role', t.cir(1, '['||t.fu(2,1)||','||t.fu(2,1)||']'), 'error:must be unique',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'')=0');
select t.adv('the owner can add a question of their own', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Who are your competitors?'')', 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and asked_by=''owner'')=1');
select t.adv('the owner can remove a question row', t.setup(1)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', :'O', 'authenticated',
  'delete from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''ow1_1''', 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'')=0');
select t.adv('a user who is not the owner cannot add a question', t.setup(1), :'A', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', 'error:row-level security');
select t.adv('an owner question needs text', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''  '')', 'error:intake_question_text');
select t.adv('an owner question without text column is refused', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'')', 'error:intake_question_text');
select t.adv('a question over 500 characters is refused', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'','''||repeat('x',501)||''')', 'error:intake_question_text');
select t.adv('a question of exactly 500 characters is kept', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'','''||repeat('x',500)||''')', 'ok');
select t.adv('a template row has no question text', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''q1'',''template'',''Q?'')', 'error:intake_question_text');
select t.adv('an owner question id must look like ow<round>_<n>', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''fu1_1'',''owner'',''Q?'')', 'error:intake_question_id');
select t.adv('an agent question id must look like fu<round>_<n>', t.setup(1), null, current_user,
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''agent'',''Q?'')', 'error:intake_question_id');

\echo '### question rows: identity and edge cases (review of P2-T06)'
select t.adv('a question id with a leading zero is refused', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow01_1'',''owner'',''Q?'')', 'error:intake_question_id');
select t.adv('a question number of zero is refused', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_0'',''owner'',''Q?'')', 'error:intake_question_id');
select t.adv('an owner question id naming another round is refused', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow3_1'',''owner'',''Q?'')', 'error:intake_question_round');
select t.adv('an owner question in the round its id names is fine', t.setup(2), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''ow2_1'',''owner'',''Q?'')', 'ok');
select t.adv('the owner cannot write an agent question directly', t.setup(1), :'O', 'authenticated',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''fu2_1'',''agent'',''Q?'')', 'error:written only by complete_intake_review');
select t.adv('the worker cannot write an agent question directly', t.setup(1), null, 'service_role',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''fu2_1'',''agent'',''Q?'')', 'error:written only by complete_intake_review');
select t.adv('the owner can answer a follow-up row', t.setup(1)||';'||t.ir(2,'open')||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''fu2_1'',''agent'',''Which pages?'')', :'O', 'authenticated',
  'update intake_responses set answer=''"yes"'' where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''fu2_1''', 'ok',
  '(select answer from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''fu2_1'')=''"yes"''::jsonb');
select t.adv('the owner cannot rewrite a question', t.setup(1)||';'||t.ir(2,'open')||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''fu2_1'',''agent'',''Which pages?'')', :'O', 'authenticated',
  'update intake_responses set question=''changed'' where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''fu2_1''', 'error:only the answer of an intake row can change');
select t.adv('the owner cannot change who asked', t.setup(1)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', :'O', 'authenticated',
  'update intake_responses set asked_by=''template'', question=null where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''ow1_1''', 'error:only the answer of an intake row can change');
select t.adv('the owner cannot move a row to another round', t.setup(2)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', :'O', 'authenticated',
  'update intake_responses set round=2 where project_id=''cccccccc-0000-0000-0000-000000000001'' and question_id=''ow1_1''', 'error:only the answer of an intake row can change');
select t.adv('anon cannot add a question', t.setup(1), null, 'anon',
  'insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', 'error');
select t.adv('a user who is not the owner cannot remove a question', t.setup(1)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', :'A', 'authenticated',
  'delete from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001''', 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'')=1');
select t.adv('a user who is not the owner cannot change a question row', t.setup(1)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',1,''ow1_1'',''owner'',''Q?'')', :'A', 'authenticated',
  'update intake_responses set answer=''"x"'' where project_id=''cccccccc-0000-0000-0000-000000000001''', 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and answer is null)=1');
select t.adv('the review is still saved when the owner added a question of their own', t.setup(1)||';insert into intake_responses(project_id,round,question_id,asked_by,question) values (''cccccccc-0000-0000-0000-000000000001'',2,''ow2_1'',''owner'',''Q?'')', null, 'service_role', t.cir(1, '['||t.fu(2,1)||']'), 'ok',
  '(select count(*) from intake_responses where project_id=''cccccccc-0000-0000-0000-000000000001'' and round=2)=2');
