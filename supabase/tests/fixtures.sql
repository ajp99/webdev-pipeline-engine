-- Test helper and fixture rows. Loaded after the migration.
--   t.run(name, user id, role, statement, expected)
-- runs one statement as a Supabase role inside a savepoint that is always rolled back, and
-- reports PASS or FAIL against the expected outcome: 'ok:N' (N rows affected or returned) or
-- 'error'. Every row below is created as the superuser, so row-level security does not apply.
create schema t;
create function t.run(name text, uid uuid, rl text, stmt text, expect text) returns text
language plpgsql as $$
declare n bigint; res text;
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    perform set_config('request.jwt.claim.role', rl, true);
    execute format('set local role %I', rl);
    execute stmt;
    get diagnostics n = row_count;
    raise exception 'T_ROLLBACK:%', n;
  exception when others then
    if sqlerrm like 'T_ROLLBACK:%' then res := 'ok:' || substr(sqlerrm, 12);
    else res := 'error';
    end if;
  end;
  return case when res = expect then 'PASS      ' || name
              else 'FAIL      ' || name || ' (expected ' || expect || ', got ' || res || ')' end;
end $$;
grant usage on schema t to authenticated, service_role;
-- Stands in for the grants Supabase makes to every new table. The approvals and gate_feedback tables are
-- skipped: the migration revokes their write privileges, and this blanket grant (which runs after it) must not undo that.
do $$
declare tb text;
begin
  for tb in select tablename from pg_tables where schemaname = 'public' and tablename not in ('approvals', 'gate_feedback') loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', tb);
    execute format('grant all on public.%I to service_role', tb);
  end loop;
end $$;
grant select, update, delete on public.approvals to authenticated;
grant select on public.gate_feedback to authenticated, service_role;
grant select, update, delete on public.approvals to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- People: O is the owner (the only login until go-live, D-298). A and B are plain users who are not owners;
-- they stand for anyone who is not the owner.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@x'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@x'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x');
insert into owners (id) values ('00000000-0000-0000-0000-0000000000a0');
insert into projects (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'P1'),
  ('22222222-2222-2222-2222-222222222222', 'P2');
insert into owner_notes (project_id, body) values ('11111111-1111-1111-1111-111111111111', 'private');

-- Artifacts of project 1.
insert into artifacts (id, project_id, type, version, status) values
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'prd', 1, 'draft'),
  ('aaaaaaa1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'prd', 2, 'superseded'),
  ('aaaaaaa1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'prototype', 1, 'draft'),
  ('aaaaaaa1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'handover_guide', 1, 'approved'),
  ('aaaaaaa1-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'plan', 1, 'draft'),
  ('aaaaaaa1-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'release_note', 1, 'draft'),
  ('bbbbbbb1-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'prd', 1, 'draft');

insert into intake_rounds (project_id, round, status) values ('11111111-1111-1111-1111-111111111111', 1, 'open');
insert into intake_responses (project_id, round, question_id, answer, asked_by)
  values ('11111111-1111-1111-1111-111111111111', 1, 'q0', '"a"', 'template');
insert into uploads (id, project_id, kind, storage_path, mime_type, size_bytes, scan_status)
  values ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'logo', '11111111-1111-1111-1111-111111111111/p', 'image/png', 1000, 'clean');
insert into comments (project_id, body, kind, created_by)
  values ('11111111-1111-1111-1111-111111111111', 'fixture note', 'prototype', '00000000-0000-0000-0000-0000000000a0');
insert into prd_feedback (project_id, artifact_id, body, created_by)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaa1-0000-0000-0000-000000000001', 'fixture feedback', '00000000-0000-0000-0000-0000000000a0');
insert into approvals (artifact_id, approved_by, role, gate_type)
  values ('aaaaaaa1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'owner', 'soft');
insert into change_requests (project_id, description, submitted_by) values
  ('11111111-1111-1111-1111-111111111111', 'cr1', 'client'),
  ('22222222-2222-2222-2222-222222222222', 'cr2', 'client');
insert into rounds (project_id, number) values ('11111111-1111-1111-1111-111111111111', 1);
insert into backlog_items (project_id, question, ask_client) values
  ('11111111-1111-1111-1111-111111111111', 'visible q', true),
  ('11111111-1111-1111-1111-111111111111', 'hidden q', false);
insert into stage_runs (id, project_id, stage, status)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'build_rounds', 'running');
