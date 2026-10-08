-- 0001_init.sql
-- Draft data model for CreatePipeline Engine. Derived from docs/spec/10-data-model.md,
-- docs/spec/12-security.md and docs/spec/gates.yaml.
--
-- DRAFT: column types and constraints are the drafter's choices where the spec lists only
-- field names; the owner has accepted the choices recorded in DECISIONS.md (see DECISIONS.md).
-- Review once more in phase 1 (task P1-T02) before applying to a real project.
-- Not yet implemented: Storage bucket policies for uploads (task P2-T03), client email records (P2-T11), the approval checks
-- inside advance_stage() (task P1-T07), and the queue claim function (task P2-T04).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- D-038: the spec snapshot lists build_round_n as a stage value. Modeled here as one repeating
-- stage 'build_rounds'; the round number lives in rounds.number.
create type stage as enum (
  'intake', 'requirements', 'plan', 'prototype', 'build_rounds',
  'qc_report', 'deploy_prep', 'handover', 'closed'
);
create type project_status as enum ('active', 'paused', 'closed');
create type close_reason as enum ('completed', 'cancelled');
create type gate_type as enum ('soft', 'hard', 'client');
create type approver_role as enum ('owner', 'client');
create type artifact_status as enum ('draft', 'approved', 'superseded');
create type asked_by as enum ('template', 'agent');
create type comment_disposition as enum ('forwarded', 'change_request', 'ignored');
-- D-174: after go-live an accepted change request runs as a mini-round (accept_mini_round).
create type change_decision as enum ('accept_current_round', 'accept_mini_round', 'defer', 'decline');
-- D-193: the client dashboard shows each change request's status; no email.
create type change_status as enum ('received', 'accepted', 'deferred', 'declined', 'deployed');
create type skill_scope as enum ('project', 'candidate', 'library', 'deprecated');
create type skill_mark as enum ('good', 'bad');
create type template_status as enum ('draft', 'approved', 'archived');
-- D-041: status lifecycles as enums (values proposed by the drafter, accepted by the owner).
create type round_status as enum ('planned', 'building', 'in_review', 'approved');
-- D-130, D-132: a run waits for the owner's answer to a risky-command request and keeps its slot.
create type run_status as enum ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled');
create type run_approval_status as enum ('pending', 'approved', 'denied');
-- D-134: the owner chooses per ask-client answer whether it waits or triggers an immediate fix.
create type answer_action as enum ('next_round', 'immediate_fix');
-- D-113, D-118: client notes on the prototype, and on the final screenshots after QC.
create type comment_kind as enum ('prototype', 'final_screenshots');
create type backlog_status as enum ('open', 'answered', 'assumption_accepted');
-- D-078, D-079: a client can write only while a round is open; 'reviewed' locks it.
create type intake_round_status as enum ('open', 'submitted', 'reviewed');
-- D-098: uploads are scanned for malware before any agent sees them.
create type upload_scan_status as enum ('pending', 'clean', 'infected');

-- ---------------------------------------------------------------------------
-- Owner identity (D-040)
-- ---------------------------------------------------------------------------
-- The owner is recognized by membership in this table, not by a JWT claim. Rows are added with
-- the service role only; revoking access is a delete. A second owner would be a second row.
create table owners (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies)
-- ---------------------------------------------------------------------------
create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owners where id = auth.uid())
$$;

create function public.is_service_role() returns boolean
language sql stable as $$
  select coalesce(auth.role() = 'service_role', false)
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table intake_templates (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  version int not null default 1,
  sections jsonb not null default '[]'::jsonb,
  status template_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (industry, version)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  -- D-061: the template's sections are copied into the project at creation, so the project keeps
  -- the version it started with; the template id is kept for reference only.
  intake_template_id uuid references intake_templates (id),
  intake_template_snapshot jsonb,
  -- D-060: filled in by the owner-run provisioning script.
  github_repo text,
  vercel_project_id text,
  stage stage not null default 'intake',
  status project_status not null default 'active',
  close_reason close_reason,
  -- D-109, D-138, D-140: proposed by the plan, confirmed by the owner; tokens only, shown as a
  -- progress bar with no warnings.
  token_budget bigint,
  retention_until timestamptz,
  -- D-169: set by the scheduled deletion job once uploads, intake data and run logs are deleted.
  data_deleted_at timestamptz,
  round_plan jsonb,
  created_at timestamptz not null default now(),
  constraint close_reason_needs_closed check (close_reason is null or status = 'closed')
);

create table clients (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index clients_project_idx on clients (project_id);

-- The project a logged-in client belongs to. A project can have several client logins.
create function public.client_project_id() returns uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.clients where id = auth.uid()
$$;

-- One row per intake round (round 1 is the template; later rounds are follow-ups).
-- Clients write answers only while a round is 'open' (D-079). The agent's batch review sets
-- 'reviewed'; only the owner can unlock a round again.
create table intake_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  round int not null,
  status intake_round_status not null default 'open',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, round)
);
create index intake_rounds_project_idx on intake_rounds (project_id);

create table intake_responses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  round int not null,
  question_id text not null,
  answer jsonb,
  asked_by asked_by not null,
  updated_at timestamptz not null default now(),
  unique (project_id, round, question_id)
);
create index intake_responses_project_idx on intake_responses (project_id);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  kind text not null,
  storage_path text not null,
  optional boolean not null default true,
  mime_type text not null,
  size_bytes bigint not null,
  scan_status upload_scan_status not null default 'pending',
  created_at timestamptz not null default now(),
  -- D-075, D-100: 25 MB maximum; no zip files.
  constraint upload_size_limit check (size_bytes > 0 and size_bytes <= 26214400),
  -- D-211: site images over 5 MB are rejected at upload; documents and video keep 25 MB.
  constraint upload_image_size_limit check (mime_type not like 'image/%' or size_bytes <= 5242880),
  constraint upload_allowed_types check (mime_type in (
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown', 'application/json', 'video/mp4'
  ))
);
create index uploads_project_idx on uploads (project_id);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  type text not null,
  version int not null default 1,
  content jsonb not null default '{}'::jsonb,
  status artifact_status not null default 'draft',
  -- D-063: not in the spec field list. Needed so clients see only the PRD and prototype,
  -- never internal plans.
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, type, version)
);
create index artifacts_project_idx on artifacts (project_id);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts (id),
  approved_by uuid not null references auth.users (id),
  role approver_role not null,
  gate_type gate_type not null,
  at timestamptz not null default now(),
  -- Client approvals use the client gate; owner approvals use soft or hard.
  constraint role_matches_gate check ((role = 'client') = (gate_type = 'client'))
);
create index approvals_artifact_idx on approvals (artifact_id);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  number int not null,
  scope jsonb,
  preview_url text,
  -- D-056: each round is a pull request into the client repo's staging branch.
  branch text,
  pr_number int,
  pr_url text,
  -- D-133: at most 3 Feedback loops per round, then the owner must Accept or Reject.
  feedback_count int not null default 0,
  -- D-143, D-146: claim markers listed in the round summary; approving the round clears them.
  claims jsonb not null default '[]'::jsonb,
  claims_cleared_at timestamptz,
  status round_status not null default 'planned',
  unique (project_id, number),
  constraint feedback_limit check (feedback_count between 0 and 3)
);

create table backlog_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  round int,
  question text not null,
  context text,
  assumption text,
  owner_answer text,
  ask_client boolean not null default false,
  client_answer text,
  answer_action answer_action,
  status backlog_status not null default 'open',
  created_at timestamptz not null default now()
);
create index backlog_items_project_idx on backlog_items (project_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  body text not null,
  kind comment_kind not null default 'prototype',
  artifact_id uuid references artifacts (id),
  owner_disposition comment_disposition,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index comments_project_idx on comments (project_id);

create table change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  description text not null,
  impact_note text,
  decision change_decision,
  status change_status not null default 'received',
  -- D-090: clients may submit change requests from go-live until handover is complete.
  submitted_by approver_role not null default 'owner',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index change_requests_project_idx on change_requests (project_id);

-- D-174: a change-request mini-round is a round on a cr-N branch tied to the request it builds.
alter table rounds add column change_request_id uuid references change_requests (id);

create table qc_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  lighthouse jsonb,
  checklist jsonb,
  run_at timestamptz not null default now()
);

create table skills_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  scope skill_scope not null,
  project_id uuid references projects (id) on delete set null,
  version int not null default 1,
  generalization_report jsonb,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint project_scope_needs_project check (scope <> 'project' or project_id is not null)
);

-- D-050: stage_runs is the durable queue the local runner polls (every 15 to 30 seconds).
-- The runner claims a row atomically (FOR UPDATE SKIP LOCKED), refreshes heartbeat_at while
-- working, and a stale heartbeat lets the row be re-queued. The claim function comes in P2-T04.
create table stage_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  stage stage not null,
  status run_status not null default 'queued',
  queued_at timestamptz not null default now(),
  claimed_by text,
  heartbeat_at timestamptz,
  attempts int not null default 0,
  tokens_used bigint not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  -- D-082: one automatic retry, so at most 2 attempts.
  constraint attempts_limit check (attempts <= 2)
);
create index stage_runs_project_idx on stage_runs (project_id);
create index stage_runs_queue_idx on stage_runs (queued_at) where status = 'queued';

-- D-084, D-085: run logs are text rows; deleted with the project's data 90 days after close.
create table run_logs (
  id bigint generated always as identity primary key,
  run_id uuid not null references stage_runs (id) on delete cascade,
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);
create index run_logs_run_idx on run_logs (run_id, id);

-- D-130: a run asks the owner before a risky command (deleting a directory or many files,
-- force-pushing or rewriting git history). The run waits, and keeps its slot, until decided.
create table run_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references stage_runs (id) on delete cascade,
  kind text not null check (kind in ('delete_files', 'rewrite_history')),
  command text not null,
  status run_approval_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id)
);
create index run_approvals_run_idx on run_approvals (run_id);

-- D-221: one row per email the worker sends or tries to send. The unique dedupe_key is claimed
-- before sending, so a retry or a restart cannot send the same email twice. The row is updated
-- with sent_at or error afterwards. Owner-only: clients never read it.
create table email_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete cascade,
  recipient_role approver_role not null,
  recipient text not null,
  event text not null check (event in (
    'intake_followups_ready', 'prd_ready', 'prototype_ready', 'ask_client_waiting',
    'gate_ready', 'pause_request_waiting', 'run_failed'
  )),
  dedupe_key text not null unique,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index email_log_project_idx on email_log (project_id);

-- D-096: private owner notes. A separate table because clients can read their own projects row.
create table owner_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index owner_notes_project_idx on owner_notes (project_id);

-- D-087: a client's 'Request changes' note on a PRD version. Goes to the owner, never to agents.
create table prd_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  artifact_id uuid not null references artifacts (id),
  body text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index prd_feedback_project_idx on prd_feedback (project_id);

create table gate_config (
  id uuid primary key default gen_random_uuid(),
  stage stage not null,
  project_id uuid references projects (id) on delete cascade, -- null = global default
  gate_type gate_type not null,
  gatekeeper approver_role not null,
  escalate_after_hours int not null default 24 check (escalate_after_hours > 0)
);
create unique index gate_config_unique
  on gate_config (stage, gate_type, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table skill_uses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  stage stage not null,
  skill text not null,
  mark skill_mark not null,
  marked_at timestamptz not null default now()
);
create index skill_uses_project_idx on skill_uses (project_id);

-- Global gate defaults. Mirrors docs/spec/gates.yaml.
insert into gate_config (stage, gate_type, gatekeeper) values
  ('intake',       'soft',   'owner'),
  ('requirements', 'client', 'client'),
  ('plan',         'soft',   'owner'),
  ('prototype',    'soft',   'owner'),
  ('prototype',    'client', 'client'),
  ('build_rounds', 'soft',   'owner'),
  ('qc_report',    'soft',   'owner'),
  ('deploy_prep',  'hard',   'owner'),
  ('handover',     'hard',   'owner');

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
-- The approval log is append-only.
create function prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
create trigger approvals_append_only
  before update or delete on approvals
  for each row execute function prevent_mutation();

-- Agents and clients cannot write projects.stage directly. Only advance_stage() may change it.
create function guard_stage_change() returns trigger
language plpgsql as $$
begin
  if new.stage is distinct from old.stage
     and coalesce(current_setting('app.stage_advance', true), '') <> 'on' then
    raise exception 'projects.stage can only change through advance_stage()';
  end if;
  return new;
end;
$$;
create trigger projects_stage_guard
  before update of stage on projects
  for each row execute function guard_stage_change();

-- STUB (task P1-T07): must verify that every gate for the current stage in gate_config
-- (project override first, then global default) has a matching approval record, and that
-- p_next is the next stage in docs/spec/stages.yaml, before changing the stage.
create function advance_stage(p_project uuid, p_next stage) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.is_service_role()) then
    raise exception 'advance_stage: not allowed';
  end if;
  raise exception 'advance_stage: approval checks not implemented yet (P1-T07)';
  -- Once implemented, the update runs like this:
  --   perform set_config('app.stage_advance', 'on', true);
  --   update projects set stage = p_next where id = p_project;
end;
$$;
revoke all on function advance_stage(uuid, stage) from public;
grant execute on function advance_stage(uuid, stage) to authenticated, service_role;

-- A client may only change client_answer on a backlog item.
create function guard_backlog_client_update() returns trigger
language plpgsql as $$
begin
  if public.is_owner() or public.is_service_role() then
    return new;
  end if;
  if (new.id, new.project_id, new.round, new.question, new.context, new.assumption,
      new.owner_answer, new.ask_client, new.answer_action, new.status, new.created_at)
     is distinct from
     (old.id, old.project_id, old.round, old.question, old.context, old.assumption,
      old.owner_answer, old.ask_client, old.answer_action, old.status, old.created_at) then
    raise exception 'clients may only change client_answer';
  end if;
  return new;
end;
$$;
create trigger backlog_client_update_guard
  before update on backlog_items
  for each row execute function guard_backlog_client_update();

-- A client may only submit or reopen a round (open <-> submitted); the review is not theirs.
create function guard_intake_round_client_update() returns trigger
language plpgsql as $$
begin
  if public.is_owner() or public.is_service_role() then
    return new;
  end if;
  if (new.id, new.project_id, new.round, new.reviewed_at)
     is distinct from (old.id, old.project_id, old.round, old.reviewed_at) then
    raise exception 'clients may only submit or reopen a round';
  end if;
  if new.status = 'submitted' and old.status = 'open' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;
create trigger intake_round_client_update_guard
  before update on intake_rounds
  for each row execute function guard_intake_round_client_update();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table owners            enable row level security;
alter table projects          enable row level security;
alter table clients           enable row level security;
alter table intake_templates  enable row level security;
alter table intake_rounds     enable row level security;
alter table intake_responses  enable row level security;
alter table uploads           enable row level security;
alter table artifacts         enable row level security;
alter table approvals         enable row level security;
alter table rounds            enable row level security;
alter table backlog_items     enable row level security;
alter table comments          enable row level security;
alter table change_requests   enable row level security;
alter table qc_runs           enable row level security;
alter table skills_registry   enable row level security;
alter table stage_runs        enable row level security;
alter table gate_config       enable row level security;
alter table skill_uses        enable row level security;
alter table run_logs           enable row level security;
alter table run_approvals      enable row level security;
alter table email_log          enable row level security;
alter table owner_notes        enable row level security;
alter table prd_feedback       enable row level security;

-- Owner: full access to every table.
do $$
declare t text;
begin
  foreach t in array array[
    'owners', 'projects', 'clients', 'intake_templates', 'intake_responses', 'uploads', 'artifacts',
    'approvals', 'rounds', 'backlog_items', 'comments', 'change_requests', 'qc_runs',
    'skills_registry', 'stage_runs', 'gate_config', 'skill_uses',
    'intake_rounds', 'run_logs', 'owner_notes', 'prd_feedback', 'run_approvals', 'email_log'
  ] loop
    execute format(
      'create policy owner_all on %I for all to authenticated using (public.is_owner()) with check (public.is_owner())',
      t
    );
  end loop;
end $$;

-- Clients: only their own project's client-facing rows.
-- D-216: client writes are accepted only while the project is 'active' (not paused or closed).
-- D-217: each write is also tied to the stage it belongs to.
-- D-216: after close, clients read only the handover guide; their projects and clients rows stay
-- readable so they can still log in.
create function public.client_project_in(p_stages stage[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = public.client_project_id() and p.status = 'active' and p.stage = any (p_stages)
  )
$$;
create function public.client_project_not_closed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = public.client_project_id() and p.status <> 'closed'
  )
$$;
revoke all on function public.client_project_in(stage[]) from public;
revoke all on function public.client_project_not_closed() from public;
grant execute on function public.client_project_in(stage[]) to authenticated, service_role;
grant execute on function public.client_project_not_closed() to authenticated, service_role;

create policy client_read_own_project on projects
  for select to authenticated using (id = public.client_project_id());

create policy client_read_self on clients
  for select to authenticated using (id = auth.uid());

create policy client_read_rounds on intake_rounds
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
-- Submit or reopen only: the trigger above blocks every other change.
create policy client_submit_round on intake_rounds
  for update to authenticated
  using (project_id = public.client_project_id() and status in ('open', 'submitted')
         and public.client_project_in(array['intake']::stage[]))
  with check (project_id = public.client_project_id() and status in ('open', 'submitted')
              and public.client_project_in(array['intake']::stage[]));

create policy client_read_responses on intake_responses
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
create policy client_write_responses on intake_responses
  for insert to authenticated with check (
    project_id = public.client_project_id()
    and exists (select 1 from intake_rounds r
                where r.project_id = intake_responses.project_id
                  and r.round = intake_responses.round and r.status = 'open')
    and public.client_project_in(array['intake']::stage[])
  );
-- D-079: while any round is open, earlier answers can be changed too.
create policy client_update_responses on intake_responses
  for update to authenticated
  using (
    project_id = public.client_project_id()
    and exists (select 1 from intake_rounds r
                where r.project_id = intake_responses.project_id and r.status = 'open')
    and public.client_project_in(array['intake']::stage[])
  )
  with check (project_id = public.client_project_id());

create policy client_read_uploads on uploads
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
-- D-217, D-218: uploads are added and deleted only while an intake round is open.
create policy client_add_uploads on uploads
  for insert to authenticated with check (
    project_id = public.client_project_id() and scan_status = 'pending'
    and exists (select 1 from intake_rounds r
                where r.project_id = uploads.project_id and r.status = 'open')
    and public.client_project_in(array['intake']::stage[])
  );
create policy client_delete_uploads on uploads
  for delete to authenticated using (
    project_id = public.client_project_id()
    and exists (select 1 from intake_rounds r
                where r.project_id = uploads.project_id and r.status = 'open')
    and public.client_project_in(array['intake']::stage[])
  );

-- D-216: after close the only artifact a client can read is the handover guide.
create policy client_read_visible_artifacts on artifacts
  for select to authenticated using (
    project_id = public.client_project_id() and client_visible
    and (public.client_project_not_closed() or type = 'handover_guide')
  );

create policy client_read_approvals on approvals
  for select to authenticated using (
    exists (select 1 from artifacts a
            where a.id = artifact_id and a.project_id = public.client_project_id() and a.client_visible
              and (public.client_project_not_closed() or a.type = 'handover_guide'))
  );
-- D-217: a client approves the PRD only during requirements and the prototype only during
-- prototype. Approvals are append-only, so a stray one would be permanent.
create policy client_add_approval on approvals
  for insert to authenticated with check (
    role = 'client' and gate_type = 'client' and approved_by = auth.uid()
    and exists (select 1 from artifacts a
                where a.id = artifact_id and a.project_id = public.client_project_id()
                  and a.client_visible and a.status <> 'superseded'
                  and ((a.type = 'prd' and public.client_project_in(array['requirements']::stage[]))
                    or (a.type = 'prototype' and public.client_project_in(array['prototype']::stage[]))))
  );

create policy client_read_ask_client_items on backlog_items
  for select to authenticated using (
    project_id = public.client_project_id() and ask_client and public.client_project_not_closed()
  );
create policy client_answer_ask_client_items on backlog_items
  for update to authenticated
  using (project_id = public.client_project_id() and ask_client
         and public.client_project_in(array['build_rounds', 'handover']::stage[]))
  with check (project_id = public.client_project_id() and ask_client);

create policy client_read_comments on comments
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
-- D-113 and D-118: one note per revision on the prototype (while the stage is prototype), and
-- notes on the final screenshots (shared after QC, so while the stage is deploy_prep).
create policy client_add_comment on comments
  for insert to authenticated with check (
    project_id = public.client_project_id()
    and created_by = auth.uid()
    and owner_disposition is null
    and (
      (kind = 'prototype' and public.client_project_in(array['prototype']::stage[]))
      or
      (kind = 'final_screenshots' and public.client_project_in(array['deploy_prep']::stage[]))
    )
  );

create policy client_read_prd_feedback on prd_feedback
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
create policy client_request_prd_changes on prd_feedback
  for insert to authenticated with check (
    project_id = public.client_project_id()
    and created_by = auth.uid()
    and exists (select 1 from artifacts a
                where a.id = artifact_id and a.project_id = public.client_project_id()
                  and a.client_visible and a.type = 'prd')
    and public.client_project_in(array['requirements']::stage[])
  );

create policy client_read_change_requests on change_requests
  for select to authenticated using (project_id = public.client_project_id() and public.client_project_not_closed());
-- Go-live happens at deployment preparation, so the live period is the handover stage (D-219).
create policy client_submit_change_request on change_requests
  for insert to authenticated with check (
    project_id = public.client_project_id()
    and submitted_by = 'client' and created_by = auth.uid()
    and impact_note is null and decision is null and status = 'received'
    and public.client_project_in(array['handover']::stage[])
  );

-- owners, intake_templates (clients read the snapshot on their own project row), rounds,
-- qc_runs, skills_registry, stage_runs, run_logs, run_approvals, email_log, owner_notes,
-- gate_config and skill_uses have no
-- client policy: owner only. Clients get no update or delete on change_requests or prd_feedback.
