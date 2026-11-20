-- Pause requests (P4-T03, D-301): request_run_approval and decide_run_approval; the round merge record and the
-- backlog item kinds (D-332, P4-T04). Loaded after runner_suite.sql, which defines t.rid, t.sr and t.is.
\set O '00000000-0000-0000-0000-0000000000a0'
\set A '00000000-0000-0000-0000-0000000000a1'
\set Q '''eeeeeeee-0000-0000-0000-000000000001'''
\set Q2 '''eeeeeeee-0000-0000-0000-000000000002'''

create function t.rq(kind text default 'delete_files', cmd text default 'rm -r content/old', worker text default 'w1') returns text language sql as
$$ select format('select request_run_approval(%s, %L, %L, %L)', t.rid(1), worker, kind, cmd) $$;
-- A waiting run 1 held by w1 with one pending request Q (and optionally a second one, Q2).
create function t.waiting(two boolean default false) returns text language sql as
$$ select t.proj('build_rounds') || ';' || t.sr(1, 'waiting', 1, '1 second', '1 minute', 'w1')
   || format(';insert into run_approvals(id, run_id, kind, command) values (%L, %s, ''delete_files'', ''rm -r a'')', 'eeeeeeee-0000-0000-0000-000000000001', t.rid(1))
   || case when two then format(';insert into run_approvals(id, run_id, kind, command) values (%L, %s, ''rewrite_history'', ''git rebase staging'')', 'eeeeeeee-0000-0000-0000-000000000002', t.rid(1)) else '' end $$;
create function t.dec(id text, ok boolean) returns text language sql as
$$ select format('select decide_run_approval(%L, %s)', id, coalesce(ok::text, 'null')) $$;
create function t.ap(id text, st text) returns text language sql as
$$ select format('(select status::text from run_approvals where id=%L)=%L', id, st) $$;

\echo '### a pause request'
select t.adv('pause: the worker holding the run records it and the run waits', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq(), 'ok',
  t.is(1, 'status', 'waiting') || format(' and (select count(*) from run_approvals where run_id=%s and status=''pending'' and kind=''delete_files'')=1', t.rid(1)));
select t.adv('pause: another worker is refused', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq('delete_files', 'rm -r x', 'w2'), 'error:does not hold');
select t.adv('pause: a finished run is refused', t.proj('build_rounds') || ';' || t.sr(1, 'succeeded', 1, null, '1 minute', 'w1'), null, 'service_role', t.rq(), 'error:does not hold');
select t.adv('pause: a run being cancelled is refused', t.proj('build_rounds') || ';' || t.sr(1, 'cancel_requested', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq(), 'error:does not hold');
select t.adv('pause: an unknown kind is refused', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq('install_package'), 'error:unknown kind');
select t.adv('pause: an empty command is refused', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq('delete_files', '  '), 'error:1 to 2000');
select t.adv('pause: a command over 2000 characters is refused', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'service_role', t.rq('delete_files', repeat('x', 2001)), 'error:1 to 2000');
select t.adv('pause: the owner cannot record one', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), :'O', 'authenticated', t.rq(), 'error');
select t.adv('pause: anon cannot record one', t.proj('build_rounds') || ';' || t.sr(1, 'running', 1, '1 second', '1 minute', 'w1'), null, 'anon', t.rq(), 'error');

\echo '### the owner decides'
select t.adv('decide: approving the only request puts the run back to running', t.waiting(), :'O', 'authenticated', t.dec(:Q, true), 'ok',
  t.ap(:Q, 'approved') || ' and ' || t.is(1, 'status', 'running') || format(' and (select decided_by from run_approvals where id=%L)=%L and (select decided_at is not null from run_approvals where id=%L)', 'eeeeeeee-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'eeeeeeee-0000-0000-0000-000000000001'));
select t.adv('decide: denying the only request puts the run back to running', t.waiting(), :'O', 'authenticated', t.dec(:Q, false), 'ok', t.ap(:Q, 'denied') || ' and ' || t.is(1, 'status', 'running'));
select t.adv('decide: the run keeps waiting while another request is pending', t.waiting(true), :'O', 'authenticated', t.dec(:Q, true), 'ok', t.ap(:Q2, 'pending') || ' and ' || t.is(1, 'status', 'waiting'));
select t.adv('decide: a decided request cannot be decided again', t.waiting() || format(';update run_approvals set status=''denied'' where id=%L', 'eeeeeeee-0000-0000-0000-000000000001'), :'O', 'authenticated', t.dec(:Q, true), 'error:already denied');
select t.adv('decide: a run that is no longer waiting is refused', t.waiting() || format(';update stage_runs set status=''cancel_requested'' where id=%s', t.rid(1)), :'O', 'authenticated', t.dec(:Q, true), 'error:no longer waiting');
select t.adv('decide: a missing answer is refused', t.waiting(), :'O', 'authenticated', t.dec(:Q, null), 'error:approve or deny');
select t.adv('decide: a non-owner is refused', t.waiting(), :'A', 'authenticated', t.dec(:Q, true), 'error:not allowed');
select t.adv('decide: the worker is refused', t.waiting(), null, 'service_role', t.dec(:Q, true), 'error');
select t.adv('decide: an unknown request is refused', t.waiting(), :'O', 'authenticated', t.dec('eeeeeeee-0000-0000-0000-0000000000ff', true), 'error:request not found');

\echo '### the round merge record (D-332)'
select t.adv('round: an approved round records its merge', t.proj('build_rounds'), null, 'postgres',
  format('insert into rounds(project_id, number, status, merge_commit, merged_at) values (%L, 1, ''approved'', %L, now())', 'cccccccc-0000-0000-0000-000000000001', repeat('a', 40)), 'ok');
select t.adv('round: a round in review cannot be merged', t.proj('build_rounds'), null, 'postgres',
  format('insert into rounds(project_id, number, status, merge_commit, merged_at) values (%L, 1, ''in_review'', %L, now())', 'cccccccc-0000-0000-0000-000000000001', repeat('a', 40)), 'error:round_merged_only_when_approved');
select t.adv('round: a merge needs both the commit and the time', t.proj('build_rounds'), null, 'postgres',
  format('insert into rounds(project_id, number, status, merge_commit) values (%L, 1, ''approved'', %L)', 'cccccccc-0000-0000-0000-000000000001', repeat('a', 40)), 'error:round_merge_recorded_whole');
select t.adv('round: the merge commit is a full commit id', t.proj('build_rounds'), null, 'postgres',
  format('insert into rounds(project_id, number, status, merge_commit, merged_at) values (%L, 1, ''approved'', ''abc123'', now())', 'cccccccc-0000-0000-0000-000000000001'), 'error:merge_commit');

\echo '### backlog item kinds (P4-T04)'
select t.adv('backlog: a refused command is a kind', t.proj('build_rounds'), null, 'postgres',
  format('insert into backlog_items(project_id, question, kind) values (%L, ''curl refused'', ''refused_command'')', 'cccccccc-0000-0000-0000-000000000001'), 'ok');
select t.adv('backlog: an unknown kind is refused', t.proj('build_rounds'), null, 'postgres',
  format('insert into backlog_items(project_id, question, kind) values (%L, ''x'', ''wish'')', 'cccccccc-0000-0000-0000-000000000001'), 'error:backlog_items_kind_check');

\echo '### the owner answers only through decide_run_approval'
select t.adv('run_approvals: the owner cannot approve by a direct update', t.waiting(), :'O', 'authenticated',
  format('update run_approvals set status=''approved'' where id=%L', 'eeeeeeee-0000-0000-0000-000000000001'), 'ok', t.ap(:Q, 'pending'));
select t.adv('run_approvals: the owner cannot insert one', t.waiting(), :'O', 'authenticated',
  format('insert into run_approvals(run_id, kind, command) values (%s, ''delete_files'', ''x'')', t.rid(1)), 'error');
select t.adv('run_approvals: the owner reads them', t.waiting(), :'O', 'authenticated',
  'do $x$ begin if (select count(*) from run_approvals) <> 1 then raise exception ''cannot read''; end if; end $x$', 'ok');
