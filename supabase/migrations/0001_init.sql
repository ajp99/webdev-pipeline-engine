-- 0001_init.sql: the squashed baseline of the Phase 1 gate (D-297, D-308), which replaces the earlier
-- 0001 and 0002. Derived from docs/spec/10-data-model.md, docs/spec/12-security.md and docs/spec/gates.yaml.
--
-- Dev-only scope (D-298, D-301, D-303, D-309): no client login, so there is no clients table, signer rule,
-- client_visible flag or client row-level security; the owner records a client-gate approval with a
-- required evidence_note. There are no parked runs, no worker_commands table and no retention or erase
-- (go-live items G15 to G17). A run can be cancel_requested (D-301). approvals keeps the giver's id
-- without a foreign key beside an email snapshot (D-309).
-- Kept from the hardening of P1-T17: a private schema and an empty search_path for security-definer
-- functions, a content hash and an email snapshot on approvals, gatekeeper enforcement in advance_stage(),
-- run tracing and one active run per project.
-- Not yet implemented: accept_gate, the remaining-gates function and the artifact version-block trigger
-- (P2-T18), and the cancel function (P2-T20).

-- Supabase gives anon (and authenticated) table and function privileges by default and relies on
-- row-level security alone. anon is never used by this app, so new tables and functions in this
-- schema are not granted to it (the explicit revokes at the end cover what Supabase created first).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

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
-- 'rejected': the owner turned this version down (reject_gate); the stage stays open and no run starts.
create type artifact_status as enum ('draft', 'approved', 'rejected', 'superseded');
-- The artifact types the pipeline knows (stages.yaml outputs, plus release_note, D-223). A new type
-- is one forward migration: alter type artifact_type add value.
create type artifact_type as enum (
  'intake_record', 'prd', 'plan', 'skill_set', 'round_scope', 'prototype', 'round_preview',
  'round_summary', 'backlog', 'qc_results', 'report', 'deployment_checklist', 'handover_guide',
  'release_note'
);
create type asked_by as enum ('template', 'agent', 'owner');
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
-- 'stopped' is for runs the no-progress watchdog stops (D-232). 'cancel_requested' is a running run the
-- owner cancelled: the worker aborts it and marks it cancelled (D-301); it still holds the slot.
create type run_status as enum ('queued', 'running', 'waiting', 'cancel_requested', 'succeeded', 'failed', 'cancelled', 'stopped');
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
-- Helpers that policies and gate functions call live in the private schema, which the API does not
-- expose (D-271). Every security-definer function sets an empty search_path and names its objects.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.owners where id = auth.uid())
$$;

revoke all on function private.is_owner() from public;
grant execute on function private.is_owner() to authenticated, service_role;

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
  stage stage not null default 'intake',
  status project_status not null default 'active',
  close_reason close_reason,
  -- D-238, D-239: the change-request freeze. The owner-run transfer script sets it; from then on
  -- clients can no longer submit change requests.
  changes_frozen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint close_reason_needs_closed check (close_reason is null or status = 'closed')
);

-- Owner-only project fields. A client can read its own projects row, so anything a client must not
-- see lives here instead: one row per project, created by a trigger, no client policy.
create table project_internal (
  project_id uuid primary key references projects (id) on delete cascade,
  -- D-060: filled in by the owner-run provisioning script.
  github_repo text,
  vercel_project_id text,
  -- D-109, D-138, D-140: proposed by the plan, confirmed by the owner; tokens only, shown as a
  -- progress bar with no warnings.
  token_budget bigint,
  round_plan jsonb,
  -- D-237: why the owner cancelled the project; required by the cancel function (P2-T20).
  cancel_reason text,
  constraint cancel_reason_not_blank check (cancel_reason is null or length(btrim(cancel_reason)) > 0)
);

create function private.create_project_internal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_internal (project_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.create_project_internal() from public;
create trigger projects_create_internal after insert on projects
  for each row execute function private.create_project_internal();

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
  -- P2-T06: the text of a follow-up question lives in its row, so the owner can add or remove one. A template
  -- question has no text here (it is in the project's template copy). The review's follow-ups are copied in
  -- when the review is saved; the immutable intake_record keeps what the agent asked.
  question text,
  updated_at timestamptz not null default now(),
  unique (project_id, round, question_id),
  constraint intake_question_text check (
    (asked_by = 'template' and question is null)
    or (asked_by <> 'template' and question is not null and btrim(question) <> '' and length(question) <= 500)),
  constraint intake_question_id check (
    asked_by = 'template'
    or (asked_by = 'agent' and question_id ~ '^fu[1-9][0-9]*_[1-9][0-9]*$')
    or (asked_by = 'owner' and question_id ~ '^ow[1-9][0-9]*_[1-9][0-9]*$'))
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
  -- The object path starts with the project id, so a row cannot point at another project's file.
  constraint upload_path_in_project check (storage_path like project_id::text || '/%'),
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
  type artifact_type not null,
  version int not null default 1,
  content jsonb not null default '{}'::jsonb,
  status artifact_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (project_id, type, version),
  -- Lets comments and PRD feedback tie an artifact to the same project (composite foreign keys).
  unique (id, project_id)
);
create index artifacts_project_idx on artifacts (project_id);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts (id),
  -- D-309: the giver's user id, kept as plain data with no foreign key so the log outlives the login.
  -- An approval whose giver is no longer in owners never counts (approval_is_valid).
  approved_by uuid,
  -- D-269: a snapshot of the giver's email, written by the database.
  approved_by_email text,
  role approver_role not null,
  gate_type gate_type not null,
  -- Defaults to the database time; accept_gate is the only writer (P2-T18).
  at timestamptz not null default now(),
  -- D-265: the SHA-256 of the artifact's content when it was approved, written by the database. The
  -- empty default only keeps the generated insert type optional; the trigger replaces it and the
  -- check below refuses anything that is not a hash.
  content_sha256 text not null default '',
  -- D-298: until go-live the owner records a client-gate approval on the client's behalf and names the
  -- channel here (for example "email, 18 Oct"). The owner is the giver of every approval row.
  evidence_note text,
  constraint content_sha256_is_hex check (content_sha256 ~ '^[0-9a-f]{64}$'),
  -- Client approvals use the client gate; owner approvals use soft or hard.
  constraint role_matches_gate check ((role = 'client') = (gate_type = 'client')),
  constraint client_approval_needs_evidence check (role <> 'client' or length(btrim(coalesce(evidence_note, ''))) > 0),
  -- The same person approves the same gate on the same version once.
  constraint approvals_once unique (artifact_id, gate_type, approved_by)
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
  -- D-143, D-146: claim markers listed in the round summary; approving the round clears them.
  claims jsonb not null default '[]'::jsonb,
  claims_cleared_at timestamptz,
  status round_status not null default 'planned',
  -- D-133: the Feedback loops of a round are its gate_feedback rows (P2-T19); there is no counter column.
  unique (project_id, number)
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
  artifact_id uuid,
  owner_disposition comment_disposition,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (artifact_id, project_id) references artifacts (id, project_id)
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
  created_at timestamptz not null default now(),
  unique (id, project_id)
);
create index change_requests_project_idx on change_requests (project_id);

-- D-174: a change-request mini-round is a round on a cr-N branch tied to the request it builds.
alter table rounds add column change_request_id uuid references change_requests (id);

-- D-238: after a stage has advanced, a new version of its artifact is allowed only for an accepted
-- change request. The artifact names that request here; the version-block trigger comes with
-- accept_gate (P2-T18). The request must belong to the same project.
alter table artifacts add column change_request_id uuid;
alter table artifacts add foreign key (change_request_id, project_id)
  references change_requests (id, project_id);

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
-- working, and a stale heartbeat lets the row be re-queued. The queue functions are below (P2-T04).
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
  -- D-281: one id ties a run to its log lines; D-283: what produced the run.
  trace_id uuid not null default gen_random_uuid(),
  model text,
  prompt_hash text,
  -- D-082: one automatic retry, so at most 2 attempts.
  constraint attempts_limit check (attempts <= 2),
  constraint model_not_blank check (model is null or length(btrim(model)) > 0),
  constraint prompt_hash_is_sha256 check (prompt_hash is null or prompt_hash ~ '^[0-9a-f]{64}$'),
  unique (id, trace_id)
);
create index stage_runs_project_idx on stage_runs (project_id);
-- D-278: one running, waiting or cancel_requested run per project; a queued run does not hold the slot.
create unique index stage_runs_one_active_per_project on stage_runs (project_id)
  where status in ('running', 'waiting', 'cancel_requested');
create index stage_runs_queue_idx on stage_runs (queued_at) where status = 'queued';

-- D-084, D-085: run logs are text rows; deleted with the project's data 90 days after close.
create table run_logs (
  id bigint generated always as identity primary key,
  run_id uuid not null references stage_runs (id) on delete cascade,
  -- D-281: copied from the run by a trigger when not given; it must match the run's own trace_id.
  trace_id uuid not null,
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now(),
  constraint run_logs_trace_matches_run foreign key (run_id, trace_id)
    references stage_runs (id, trace_id) on delete cascade
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
  artifact_id uuid not null,
  body text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (artifact_id, project_id) references artifacts (id, project_id)
);
create index prd_feedback_project_idx on prd_feedback (project_id);

-- P2-T19: the owner's Feedback on an artifact waiting at a gate. The notes go to the stage's agent, which
-- makes a new version; the version itself stays a draft (the owner may still accept or reject it). Each row
-- is one Feedback loop: the caps (D-133, D-234, D-120, QC) count these rows. Written only by feedback_gate();
-- append-only.
create table gate_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  artifact_id uuid not null,
  round int,
  body text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (artifact_id, project_id) references artifacts (id, project_id),
  constraint gate_feedback_body check (btrim(body) <> '' and length(body) <= 10000),
  constraint gate_feedback_round check (round is null or round >= 1)
);
create index gate_feedback_project_idx on gate_feedback (project_id);

create table gate_config (
  id uuid primary key default gen_random_uuid(),
  stage stage not null,
  project_id uuid references projects (id) on delete cascade, -- null = global default
  gate_type gate_type not null,
  gatekeeper approver_role not null,
  escalate_after_hours int not null default 24 check (escalate_after_hours > 0),
  -- P2-T19: Feedback loops allowed in the stage (spec 03), on the stage's first gate row; null on the
  -- others (the prototype's client row). A project's own row may set its own cap.
  feedback_cap int check (feedback_cap between 0 and 10),
  -- D-272: the gatekeeper follows the gate type (soft and hard are the owner's, client is the client's).
  constraint gatekeeper_matches_gate check ((gate_type = 'client') = (gatekeeper = 'client'))
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
-- feedback_cap (spec 03): 3 on intake, PRD, plan, deploy prep and handover (D-234); 2 on the prototype
-- (D-120) and QC; 3 per build round (D-133).
insert into gate_config (stage, gate_type, gatekeeper, feedback_cap) values
  ('intake',       'soft',   'owner',  3),
  ('requirements', 'client', 'client', 3),
  ('plan',         'soft',   'owner',  3),
  ('prototype',    'soft',   'owner',  2),
  ('prototype',    'client', 'client', null),
  ('build_rounds', 'soft',   'owner',  3),
  ('qc_report',    'soft',   'owner',  2),
  ('deploy_prep',  'hard',   'owner',  3),
  ('handover',     'hard',   'owner',  3);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
-- The approval log is append-only: no update and no delete, for any role.
create function guard_approval_change() returns trigger
language plpgsql as $$
begin
  raise exception 'approvals is append-only';
end;
$$;
create trigger approvals_append_only
  before update or delete on approvals
  for each row execute function guard_approval_change();

create function guard_gate_feedback_change() returns trigger
language plpgsql as $$
begin
  raise exception 'gate_feedback is append-only';
end;
$$;
create trigger gate_feedback_append_only
  before update or delete on gate_feedback
  for each row execute function guard_gate_feedback_change();

-- The database records what was approved and who approved it (D-265, D-269): the SHA-256 of the
-- artifact's content (a version never changes, D-254) and a snapshot of the giver's email. It always
-- overwrites what the caller sent. Runs as its owner because auth.users is not readable by API roles.
create function private.stamp_approval_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select encode(sha256(convert_to(a.content::text, 'UTF8')), 'hex') into new.content_sha256
    from public.artifacts a where a.id = new.artifact_id;
  select u.email into new.approved_by_email from auth.users u where u.id = new.approved_by;
  return new;
end;
$$;
revoke all on function private.stamp_approval_snapshot() from public;
create trigger approvals_stamp_snapshot before insert on approvals
  for each row execute function private.stamp_approval_snapshot();

-- A run log line carries its run's trace_id (D-281); when the caller gives none it is copied.
create function private.default_run_log_trace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.trace_id is null then
    select s.trace_id into new.trace_id from public.stage_runs s where s.id = new.run_id;
  end if;
  return new;
end;
$$;
revoke all on function private.default_run_log_trace() from public;
create trigger run_logs_default_trace before insert on run_logs
  for each row execute function private.default_run_log_trace();

-- Global gate defaults (project_id null) are the pipeline's rules (D-272): through the API nobody can
-- delete or add one, and no gate row can change anything but its deadline. A project row can be added
-- (a stricter gate for one project) and its deadline and Feedback cap changed (P2-T19). Migrations and the SQL editor
-- (current_user is postgres) are not affected.
create function guard_gate_config() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('anon', 'authenticated', 'service_role') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.project_id is null then
      raise exception 'a global gate default cannot be deleted';
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.project_id is null then
      raise exception 'a global gate default changes only through a migration';
    end if;
    return new;
  end if;
  if (new.id, new.stage, new.project_id, new.gate_type, new.gatekeeper)
     is distinct from (old.id, old.stage, old.project_id, old.gate_type, old.gatekeeper) then
    raise exception 'a gate row changes only its deadline';
  end if;
  if old.project_id is null and new.feedback_cap is distinct from old.feedback_cap then
    raise exception 'a global Feedback cap changes only through a migration; set it on the project''s own row';
  end if;
  return new;
end;
$$;
create trigger gate_config_guard before insert or update or delete on gate_config
  for each row execute function guard_gate_config();

-- A version of an artifact never changes: id, project, type, version and content are fixed once the
-- row is written (status still changes). Feedback makes a new version.
create function guard_artifact_immutable() returns trigger
language plpgsql as $$
begin
  if (new.id, new.project_id, new.type, new.version, new.content, new.created_at)
     is distinct from (old.id, old.project_id, old.type, old.version, old.content, old.created_at) then
    raise exception 'an artifact version is immutable; write a new version instead';
  end if;
  return new;
end;
$$;
create trigger artifacts_immutable before update on artifacts
  for each row execute function guard_artifact_immutable();

-- Through the API (owner, worker or client roles) a project is created active at intake, and its
-- status moves to or from 'closed' (and close_reason changes) only through the close function.
-- Functions that run as their owner (advance_stage, the close function) and the SQL editor are
-- not affected: current_user is then postgres, not an API role.
create function guard_project_write() returns trigger
language plpgsql as $$
begin
  if current_user not in ('anon', 'authenticated', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stage <> 'intake' or new.status <> 'active' or new.close_reason is not null then
      raise exception 'a new project starts active at the intake stage';
    end if;
  elsif (new.status = 'closed') is distinct from (old.status = 'closed')
        or new.close_reason is distinct from old.close_reason then
    raise exception 'a project is closed only through the close function';
  end if;
  return new;
end;
$$;
create trigger projects_write_guard before insert or update on projects
  for each row execute function guard_project_write();

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

-- A project moves forward only through this function, only one stage at a time (the order of the
-- stage enum is the order in docs/spec/stages.yaml), and only while it is active.
--
-- Which artifact's approvals gate each stage (artifacts.type):
--   intake=intake_record  requirements=prd  plan=plan  prototype=prototype
--   qc_report=report  deploy_prep=deployment_checklist  handover=handover_guide
--   build_rounds: one round_summary artifact per round (version = round number), see below.
-- Approvals on any other artifact type (for example release_note, D-223) never count.
--
-- Required approvals for a stage = the gate types in gate_config for that stage: the global
-- defaults plus any gate types the project adds with its own rows. A project row never removes a
-- global gate; it can only add one or change its gatekeeper and deadline.
-- The approvals must sit on the newest version of the artifact (not superseded). When a stage has
-- an owner gate and a client gate (prototype), the client approval must come at or after an owner
-- approval on the same version.
--
-- build_rounds: leaves only when the project has at least one build round and every build round
-- (change-request mini-rounds are ignored) has status approved and a soft approval on its newest
-- round_summary. A round_summary artifact carries {"round": N} in its content; Feedback on a round
-- makes a new version for the same N, and versions are unique per project, so they rise across rounds.
--
-- handover -> closed also sets status closed and close_reason completed in the same call (D-220),
-- through close_project().
-- An approval counts only when its giver is an owner; the owner records the client's approval on the
-- client's behalf, with an evidence note (D-298).
create function private.approval_is_valid(ap public.approvals, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- D-298: every approval is given by an owner; a client-role row is the owner's record of the client's
  -- approval (its evidence_note is required by a check). A giver who is no longer in owners never counts.
  select exists (select 1 from public.owners o where o.id = ap.approved_by)
$$;
-- Only advance_stage() (which runs as its owner) calls it, so no API role needs execute.
revoke all on function private.approval_is_valid(public.approvals, uuid) from public, anon, authenticated, service_role;



-- ---------------------------------------------------------------------------
-- Gate rules in the database (P2-T18, D-239, D-258, D-261, D-318)
-- ---------------------------------------------------------------------------
-- The artifact type whose approvals gate a stage (null for stages without one; build_rounds is gated per
-- round by round_summary artifacts).
create function private.stage_artifact(p_stage public.stage) returns public.artifact_type
language sql immutable set search_path = '' as $$
  select case p_stage
    when 'intake'       then 'intake_record'::public.artifact_type
    when 'requirements' then 'prd'
    when 'plan'         then 'plan'
    when 'prototype'    then 'prototype'
    when 'qc_report'    then 'report'
    when 'deploy_prep'  then 'deployment_checklist'
    when 'handover'     then 'handover_guide'
  end
$$;
-- The stage an artifact type is gated in (the reverse of the above, plus round_summary and release_note).
create function private.artifact_stage(p_type public.artifact_type) returns public.stage
language sql immutable set search_path = '' as $$
  select case p_type
    when 'intake_record'         then 'intake'::public.stage
    when 'prd'                   then 'requirements'
    when 'plan'                  then 'plan'
    when 'prototype'             then 'prototype'
    when 'round_summary'         then 'build_rounds'
    when 'report'                then 'qc_report'
    when 'deployment_checklist'  then 'deploy_prep'
    when 'handover_guide'        then 'handover'
  end
$$;
-- The stages that have a runnable agent: accept_gate queues a run only when it moves a project into one of
-- them. None yet; the task that adds an agent adds its stage here (requirements with P2-T07).
create function private.stage_has_agent(p_stage public.stage) returns boolean
language sql immutable set search_path = '' as $$
  select p_stage = any (array[]::public.stage[])
$$;
-- The gates of a stage as they apply to one project: the global defaults, with the project's own row
-- winning for a gate type (D-272).
create function private.effective_gates(p_project uuid, p_stage public.stage)
returns table (gate_type public.gate_type, gatekeeper public.approver_role, escalate_after_hours int)
language sql stable security definer set search_path = '' as $$
  select distinct on (g.gate_type) g.gate_type, g.gatekeeper, g.escalate_after_hours
    from public.gate_config g
   where g.stage = p_stage and (g.project_id is null or g.project_id = p_project)
   order by g.gate_type, g.project_id nulls last
$$;
-- D-318: intake is accepted only when the latest intake round is reviewed (a review that asks follow-up
-- questions opens the next round, so an open or submitted latest round means one is still waiting). A
-- project with no round at all is not blocked.
create function private.intake_blocker(p_project uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.intake_rounds%rowtype;
begin
  select * into r from public.intake_rounds where project_id = p_project order by round desc limit 1;
  if found and r.status <> 'reviewed' then
    return format('the latest intake round is not reviewed yet (round %s is %s)', r.round, r.status);
  end if;
  return null;
end;
$$;
-- Why a project cannot move to its next stage yet, or null when it can. advance_stage() raises it;
-- remaining_gates() reports whether it is null as ready_to_advance, so the two cannot drift apart.
create function private.advance_blocker(p_project uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v         public.projects%rowtype;
  atype     public.artifact_type;
  art       public.artifacts%rowtype;
  gt        public.gate_type;
  gk        public.approver_role;
  req       public.gate_type[];
  ib        text;
begin
  select * into v from public.projects where id = p_project;
  if not found then
    return 'project not found';
  end if;
  if v.stage = 'build_rounds' then
    if not exists (select 1 from public.rounds where project_id = p_project and change_request_id is null) then
      return 'no build rounds exist yet';
    end if;
    if exists (
      select 1 from public.rounds r
      where r.project_id = p_project and r.change_request_id is null
        and (r.status <> 'approved'
          or not exists (
            select 1 from public.artifacts a join public.approvals ap on ap.artifact_id = a.id
            where a.project_id = p_project and a.type = 'round_summary'
              and a.content ->> 'round' = r.number::text
              and a.status not in ('superseded', 'rejected') and ap.gate_type = 'soft'
              and private.approval_is_valid(ap, p_project)
              and a.version = (select max(b.version) from public.artifacts b
                               where b.project_id = p_project and b.type = 'round_summary'
                                 and b.content ->> 'round' = r.number::text)))
    ) then
      return 'every build round must be approved with a soft approval on its newest round_summary';
    end if;
  else
    atype := private.stage_artifact(v.stage);

    select * into art from public.artifacts
      where project_id = p_project and type = atype
      order by version desc limit 1;
    if not found or art.status in ('superseded', 'rejected') then
      return format('no current %s artifact to approve for stage %s', atype, v.stage);
    end if;

    select array_agg(distinct g.gate_type) into req
      from public.gate_config g
      where g.stage = v.stage and (g.project_id is null or g.project_id = p_project);

    -- Each gate needs a valid approval given in the role of its effective gatekeeper (the project's own
    -- row first, then the global default, D-272).
    foreach gt in array req loop
      select g.gatekeeper into gk from public.gate_config g
        where g.stage = v.stage and g.gate_type = gt and (g.project_id is null or g.project_id = p_project)
        order by g.project_id nulls last limit 1;
      if not exists (select 1 from public.approvals ap
                     where ap.artifact_id = art.id and ap.gate_type = gt and ap.role = gk
                       and private.approval_is_valid(ap, p_project)) then
        return format('missing %s approval on %s v%s for stage %s', gt, atype, art.version, v.stage);
      end if;
    end loop;

    if 'client' = any (req) and array_length(req, 1) > 1 then
      if not exists (
        select 1 from public.approvals c join public.approvals o on o.artifact_id = c.artifact_id
        where c.artifact_id = art.id and c.gate_type = 'client' and o.gate_type <> 'client' and o.at <= c.at
          and private.approval_is_valid(c, p_project) and private.approval_is_valid(o, p_project)
      ) then
        return 'the client approval must come after an owner approval';
      end if;
    end if;
    -- D-318: intake is accepted only on a settled round.
    if v.stage = 'intake' then
      ib := private.intake_blocker(p_project);
      if ib is not null then
        return ib;
      end if;
    end if;
    -- close_project() refuses to complete a project with an accepted change request that is not deployed.
    if v.stage = 'handover' and exists (
      select 1 from public.change_requests c where c.project_id = p_project and c.status = 'accepted'
    ) then
      return 'an accepted change request is not deployed yet';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.stage_artifact(public.stage), private.artifact_stage(public.artifact_type),
  private.stage_has_agent(public.stage), private.effective_gates(uuid, public.stage),
  private.intake_blocker(uuid), private.advance_blocker(uuid)
  from public, anon, authenticated, service_role;
-- The version-block trigger runs with the caller's rights and reads this pure mapping.
grant execute on function private.artifact_stage(public.artifact_type) to authenticated, service_role;

create function advance_stage(p_project uuid, p_next stage) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v         public.projects%rowtype;
  stages    public.stage[] := enum_range(null::public.stage);
  idx       int;
  blocker   text;
begin
  if not private.is_owner() then
    raise exception 'advance_stage: not allowed';
  end if;

  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'advance_stage: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'advance_stage: project is %, only an active project can advance', v.status;
  end if;
  if v.stage = 'closed' then
    raise exception 'advance_stage: project is already closed';
  end if;

  idx := array_position(stages, v.stage);
  if p_next is distinct from stages[idx + 1] then
    raise exception 'advance_stage: % is not the stage after %', p_next, v.stage;
  end if;

  blocker := private.advance_blocker(p_project);
  if blocker is not null then
    raise exception 'advance_stage: %', blocker;
  end if;

  perform set_config('app.stage_advance', 'on', true);
  if v.stage = 'handover' then
    update public.projects set stage = p_next where id = p_project;
    perform private.close_project(p_project, 'completed');
  else
    update public.projects set stage = p_next where id = p_project;
  end if;
  perform set_config('app.stage_advance', 'off', true);
end;
$$;
revoke all on function advance_stage(uuid, stage) from public, anon, service_role;
grant execute on function advance_stage(uuid, stage) to authenticated;

-- The artifact a gate action applies to: it must belong to the project, be the newest version of the stage's
-- gated type (for build rounds, the newest summary of the named round) and still be a draft. Used by
-- accept_gate, reject_gate and feedback_gate, so a stale console form cannot act on an old version.
create function private.current_gate_artifact(p_project uuid, p_artifact uuid, p_round int, p_fn text)
returns public.artifacts
language plpgsql stable security definer set search_path = '' as $$
declare
  v      public.projects%rowtype;
  art    public.artifacts%rowtype;
  newest int;
begin
  select * into v from public.projects where id = p_project;
  select * into art from public.artifacts where id = p_artifact and project_id = p_project;
  if not found then
    raise exception '%: that artifact does not belong to this project', p_fn;
  end if;
  if v.stage = 'build_rounds' then
    if p_round is null then
      raise exception '%: name the build round', p_fn;
    end if;
    if art.type <> 'round_summary' or art.content ->> 'round' is distinct from p_round::text then
      raise exception '%: that is not a summary of round %', p_fn, p_round;
    end if;
    select max(b.version) into newest from public.artifacts b
      where b.project_id = p_project and b.type = 'round_summary' and b.content ->> 'round' = p_round::text;
  else
    if p_round is not null then
      raise exception '%: only build rounds take a round number', p_fn;
    end if;
    if art.type is distinct from private.stage_artifact(v.stage) then
      raise exception '%: stage % is gated by a % artifact', p_fn, v.stage, private.stage_artifact(v.stage);
    end if;
    select max(b.version) into newest from public.artifacts b
      where b.project_id = p_project and b.type = art.type;
  end if;
  if art.version <> newest then
    raise exception '%: that is not the newest version of the % (reload)', p_fn, art.type;
  end if;
  if art.status <> 'draft' then
    raise exception '%: that version is already %', p_fn, art.status;
  end if;
  return art;
end;
$$;
revoke all on function private.current_gate_artifact(uuid, uuid, int, text)
  from public, anon, authenticated, service_role;

-- Accept: records the owner's approval of one gate and marks the artifact approved when its gates are all
-- done (D-258). It advances the project in the same transaction only when this approval completes the gates
-- and the gate is the owner's: a client sign-off, which the owner records with an evidence note (D-298),
-- never advances (D-234). Returns what happened: 'recorded' (more owner gates follow), 'waiting_on_client',
-- 'ready_to_advance' (the owner presses Advance) or 'advanced'. For build rounds p_round names the round,
-- which becomes approved; the stage never advances from there.
create function accept_gate(p_project uuid, p_gate public.gate_type, p_artifact uuid,
                            p_note text default null, p_round int default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v       public.projects%rowtype;
  art     public.artifacts%rowtype;
  gk      public.approver_role;
  g       record;
  stages  public.stage[] := enum_range(null::public.stage);
  nxt     public.stage;
  blocker text;
  left_n  int := 0;
  client_left boolean := false;
begin
  if not private.is_owner() then
    raise exception 'accept_gate: not allowed';
  end if;
  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'accept_gate: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'accept_gate: project is %, only an active project can be accepted', v.status;
  end if;

  select e.gatekeeper into gk from private.effective_gates(p_project, v.stage) e where e.gate_type = p_gate;
  if gk is null then
    raise exception 'accept_gate: stage % has no % gate', v.stage, p_gate;
  end if;
  art := private.current_gate_artifact(p_project, p_artifact, p_round, 'accept_gate');

  if exists (select 1 from public.approvals ap
              where ap.artifact_id = art.id and ap.gate_type = p_gate and ap.role = gk
                and private.approval_is_valid(ap, p_project)) then
    raise exception 'accept_gate: the % gate is already approved on this version', p_gate;
  end if;
  if v.stage = 'build_rounds' then
    -- A round is accepted at the soft gate; the stage has no other gate to pass per round.
    if p_gate <> 'soft' then
      raise exception 'accept_gate: a build round is accepted at its soft gate';
    end if;
    if not exists (select 1 from public.rounds r where r.project_id = p_project and r.number = p_round and r.status = 'in_review') then
      raise exception 'accept_gate: round % is not in review', p_round;
    end if;
  else
    -- Gates are passed in order (soft, hard, client): every earlier gate of the stage needs its approval.
    for g in select * from private.effective_gates(p_project, v.stage) e where e.gate_type < p_gate loop
      if not exists (select 1 from public.approvals ap
                      where ap.artifact_id = art.id and ap.gate_type = g.gate_type and ap.role = g.gatekeeper
                        and private.approval_is_valid(ap, p_project)) then
        raise exception 'accept_gate: the % approval must come first', g.gate_type;
      end if;
    end loop;
  end if;
  if gk = 'client' and btrim(coalesce(p_note, '')) = '' then
    raise exception 'accept_gate: a client approval needs an evidence note naming the channel';
  end if;
  -- D-318
  if v.stage = 'intake' then
    blocker := private.intake_blocker(p_project);
    if blocker is not null then
      raise exception 'accept_gate: %', blocker;
    end if;
  end if;

  insert into public.approvals (artifact_id, approved_by, role, gate_type, evidence_note)
  values (art.id, auth.uid(), gk, p_gate, nullif(btrim(p_note), ''));

  if v.stage = 'build_rounds' then
    update public.rounds set status = 'approved' where project_id = p_project and number = p_round;
    update public.artifacts set status = 'approved' where id = art.id;
    return case when private.advance_blocker(p_project) is null then 'ready_to_advance' else 'recorded' end;
  end if;

  for g in select * from private.effective_gates(p_project, v.stage) loop
    if not exists (select 1 from public.approvals ap
                    where ap.artifact_id = art.id and ap.gate_type = g.gate_type and ap.role = g.gatekeeper
                      and private.approval_is_valid(ap, p_project)) then
      left_n := left_n + 1;
      if g.gatekeeper = 'client' then
        client_left := true;
      end if;
    end if;
  end loop;

  if left_n > 0 then
    return case when client_left then 'waiting_on_client' else 'recorded' end;
  end if;
  update public.artifacts set status = 'approved' where id = art.id;
  if gk = 'client' then
    return 'ready_to_advance';
  end if;
  nxt := stages[array_position(stages, v.stage) + 1];
  perform public.advance_stage(p_project, nxt);
  -- A run still queued belongs to the stage the project just left (or repeats the one about to start): it
  -- would block enqueue_run and never be claimed, so it is cancelled first.
  for g in select r.id from public.stage_runs r where r.project_id = p_project and r.status = 'queued' loop
    perform public.request_run_cancel(g.id);
  end loop;
  if private.stage_has_agent(nxt) then
    perform public.enqueue_run(p_project, nxt);
  end if;
  return 'advanced';
end;
$$;
revoke all on function accept_gate(uuid, public.gate_type, uuid, text, int) from public, anon, authenticated, service_role;
grant execute on function accept_gate(uuid, public.gate_type, uuid, text, int) to authenticated;

-- Reject: marks the version rejected. The stage stays open and no run starts (D-234); a new version comes
-- from the next run.
create function reject_gate(p_project uuid, p_artifact uuid, p_round int default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v   public.projects%rowtype;
  art public.artifacts%rowtype;
begin
  if not private.is_owner() then
    raise exception 'reject_gate: not allowed';
  end if;
  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'reject_gate: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'reject_gate: project is %, only an active project can be rejected from', v.status;
  end if;
  art := private.current_gate_artifact(p_project, p_artifact, p_round, 'reject_gate');
  if v.stage = 'build_rounds' and not exists (
    select 1 from public.rounds r where r.project_id = p_project and r.number = p_round and r.status = 'in_review'
  ) then
    raise exception 'reject_gate: round % is not in review', p_round;
  end if;
  update public.artifacts set status = 'rejected' where id = art.id;
end;
$$;
revoke all on function reject_gate(uuid, uuid, int) from public, anon, authenticated, service_role;
grant execute on function reject_gate(uuid, uuid, int) to authenticated;

-- Feedback loops allowed in a stage: a cap on one of the project's own gate rows wins, else the global
-- default (on the stage's first gate row). No cap anywhere means no Feedback.
create function private.feedback_cap(p_project uuid, p_stage public.stage) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select g.feedback_cap from public.gate_config g
      where g.stage = p_stage and g.project_id = p_project and g.feedback_cap is not null
      order by g.gate_type limit 1),
    (select g.feedback_cap from public.gate_config g
      where g.stage = p_stage and g.project_id is null and g.feedback_cap is not null
      order by g.gate_type limit 1),
    0)
$$;
-- Feedback loops used: every Feedback on any version of the type (for build rounds, of that round).
create function private.feedback_used(p_project uuid, p_type public.artifact_type, p_round int) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.gate_feedback f join public.artifacts a on a.id = f.artifact_id
   where f.project_id = p_project and a.type = p_type and f.round is not distinct from p_round
$$;
revoke all on function private.feedback_cap(uuid, public.stage), private.feedback_used(uuid, public.artifact_type, int)
  from public, anon, authenticated, service_role;

-- Feedback: records the owner's notes on the newest draft of the stage's artifact; the version stays a draft
-- (Accept and Reject still work). A rejected version gets no Feedback: the owner waits for a new version or
-- edits by hand. Refused once the stage's cap (gate_config.feedback_cap) is used up; after that only Accept or
-- Reject is left. For build rounds the round must be in review and the cap counts per round. When the stage has an agent a run is queued in
-- the same transaction, unless one is queued already (it will read these notes too). Returns the number of
-- loops used, this one included.
create function feedback_gate(p_project uuid, p_artifact uuid, p_body text, p_round int default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v    public.projects%rowtype;
  art  public.artifacts%rowtype;
  used int;
  cap  int;
begin
  if not private.is_owner() then
    raise exception 'feedback_gate: not allowed';
  end if;
  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'feedback_gate: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'feedback_gate: project is %, only an active project can get feedback', v.status;
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'feedback_gate: write the feedback first';
  end if;
  art := private.current_gate_artifact(p_project, p_artifact, p_round, 'feedback_gate');
  if v.stage = 'build_rounds' and not exists (
    select 1 from public.rounds r where r.project_id = p_project and r.number = p_round and r.status = 'in_review'
  ) then
    raise exception 'feedback_gate: round % is not in review', p_round;
  end if;
  used := private.feedback_used(p_project, art.type, p_round);
  cap := private.feedback_cap(p_project, v.stage);
  if cap = 0 then
    raise exception 'feedback_gate: stage % takes no feedback', v.stage;
  end if;
  if used >= cap then
    raise exception 'feedback_gate: the % feedback loops on this % are used up; accept or reject it', cap, art.type;
  end if;

  insert into public.gate_feedback (project_id, artifact_id, round, body, created_by)
  values (p_project, art.id, p_round, btrim(p_body), auth.uid());
  if private.stage_has_agent(v.stage)
     and not exists (select 1 from public.stage_runs r where r.project_id = p_project and r.status = 'queued') then
    perform public.enqueue_run(p_project, v.stage);
  end if;
  return used + 1;
end;
$$;
revoke all on function feedback_gate(uuid, uuid, text, int) from public, anon, authenticated, service_role;
grant execute on function feedback_gate(uuid, uuid, text, int) to authenticated;

-- The gates of every active project (or one) that the console shows, one row per gate (D-261). state:
-- 'satisfied'; 'missing' (the next gate to pass); 'blocked' (an earlier gate of the stage is not approved
-- yet); 'waiting' (no current artifact or round in review: the agent has to produce it). since is when the
-- gate began to wait (the artifact's time, moved on by earlier approvals) and due_at adds the gate's
-- deadline. ready_to_advance is the same on every row of a project: all its gates are approved and only
-- the owner's Advance is left. feedback_used and feedback_cap count the Feedback loops on the gated type
-- (per round for build rounds); the console offers Feedback only while used < cap. A build_rounds project with no round in review gets one row with no round.
create function remaining_gates(p_project uuid default null)
returns table (
  project_id uuid, stage public.stage, gate_type public.gate_type, gatekeeper public.approver_role,
  round int, artifact_id uuid, artifact_type public.artifact_type, artifact_version int,
  state text, since timestamptz, due_at timestamptz, overdue boolean, ready_to_advance boolean,
  feedback_used int, feedback_cap int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  pr      public.projects%rowtype;
  art     public.artifacts%rowtype;
  g       record;
  rd      record;
  atype   public.artifact_type;
  ready   boolean;
  pending boolean;
  s       timestamptz;
  t       timestamptz;
  gk      public.approver_role;
  hrs     int;
  n       int;
  fu      int;
  fc      int;
  has_art boolean;
begin
  if not private.is_owner() then
    raise exception 'remaining_gates: not allowed';
  end if;
  for pr in select * from public.projects p
             where p.status = 'active' and p.stage <> 'closed' and (p_project is null or p.id = p_project)
             order by p.created_at, p.id loop
    ready := private.advance_blocker(pr.id) is null;
    if pr.stage = 'build_rounds' then
      select e.gatekeeper, e.escalate_after_hours into gk, hrs
        from private.effective_gates(pr.id, pr.stage) e where e.gate_type = 'soft';
      gk := coalesce(gk, 'owner');
      hrs := coalesce(hrs, 24);
      n := 0;
      for rd in select r.number from public.rounds r where r.project_id = pr.id and r.status = 'in_review' order by r.number loop
        n := n + 1;
        fu := private.feedback_used(pr.id, 'round_summary', rd.number);
        fc := private.feedback_cap(pr.id, pr.stage);
        select * into art from public.artifacts a
          where a.project_id = pr.id and a.type = 'round_summary' and a.content ->> 'round' = rd.number::text
          order by a.version desc limit 1;
        has_art := found;
        if has_art and art.status not in ('superseded', 'rejected') then
          return query select pr.id, pr.stage, 'soft'::public.gate_type, gk, rd.number, art.id, art.type, art.version,
            'missing', art.created_at, art.created_at + make_interval(hours => hrs),
            now() > art.created_at + make_interval(hours => hrs), ready, fu, fc;
        else
          return query select pr.id, pr.stage, 'soft'::public.gate_type, gk, rd.number, null::uuid,
            'round_summary'::public.artifact_type, null::int, 'waiting', null::timestamptz, null::timestamptz, false, ready,
            fu, fc;
        end if;
      end loop;
      if n = 0 then
        return query select pr.id, pr.stage, 'soft'::public.gate_type, gk, null::int, null::uuid,
          'round_summary'::public.artifact_type, null::int, case when ready then 'satisfied' else 'waiting' end,
          null::timestamptz, null::timestamptz, false, ready, null::int, null::int;
      end if;
    else
      atype := private.stage_artifact(pr.stage);
      fu := private.feedback_used(pr.id, atype, null);
      fc := private.feedback_cap(pr.id, pr.stage);
      select * into art from public.artifacts a where a.project_id = pr.id and a.type = atype
        order by a.version desc limit 1;
      has_art := found;
      if not has_art or art.status in ('superseded', 'rejected') then
        for g in select * from private.effective_gates(pr.id, pr.stage) order by gate_type loop
          return query select pr.id, pr.stage, g.gate_type, g.gatekeeper, null::int, null::uuid, atype, null::int,
            'waiting', null::timestamptz, null::timestamptz, false, false, fu, fc;
        end loop;
      else
        s := art.created_at;
        pending := false;
        for g in select * from private.effective_gates(pr.id, pr.stage) order by gate_type loop
          select max(ap.at) into t from public.approvals ap
            where ap.artifact_id = art.id and ap.gate_type = g.gate_type and ap.role = g.gatekeeper
              and private.approval_is_valid(ap, pr.id);
          if t is not null then
            s := greatest(s, t);
            return query select pr.id, pr.stage, g.gate_type, g.gatekeeper, null::int, art.id, atype, art.version,
              'satisfied', s, s + make_interval(hours => g.escalate_after_hours), false, ready, fu, fc;
          else
            return query select pr.id, pr.stage, g.gate_type, g.gatekeeper, null::int, art.id, atype, art.version,
              case when pending then 'blocked' else 'missing' end, s,
              s + make_interval(hours => g.escalate_after_hours),
              (not pending and now() > s + make_interval(hours => g.escalate_after_hours)), ready, fu, fc;
            pending := true;
          end if;
        end loop;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function remaining_gates(uuid) from public, anon, authenticated, service_role;
grant execute on function remaining_gates(uuid) to authenticated;

-- D-259: once a project is past a stage, an API caller (the owner, the worker) cannot add a new version of
-- that stage's gated artifact, unless the row names an accepted change request of the same project.
-- release_note has no gated stage and a round_summary is gated in build_rounds, so both are free while their stage is current. Functions that run as their owner and the
-- SQL editor (current_user is postgres) are not affected.
create function guard_gated_artifact_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  cur    public.stage;
  gated  public.stage;
  stages public.stage[] := enum_range(null::public.stage);
begin
  if current_user not in ('anon', 'authenticated', 'service_role') then
    return new;
  end if;
  gated := private.artifact_stage(new.type);
  if gated is null then
    return new;
  end if;
  -- Lock the project row first: a concurrent accept_gate holds it while it moves the stage, and the stage
  -- must be read after that commits, not before.
  perform 1 from public.projects p where p.id = new.project_id for share;
  select p.stage into cur from public.projects p where p.id = new.project_id;
  if cur is null or array_position(stages, cur) <= array_position(stages, gated) then
    return new;
  end if;
  if new.change_request_id is null
     or not exists (select 1 from public.change_requests c
                     where c.id = new.change_request_id and c.project_id = new.project_id and c.status = 'accepted') then
    raise exception 'the project is past the % stage; a new % version needs an accepted change request', gated, new.type;
  end if;
  return new;
end;
$$;
create trigger artifacts_version_block before insert on artifacts
  for each row execute function guard_gated_artifact_version();


-- The one place a project is closed (D-237). Completed closes come from advance_stage() at the end
-- of handover; the cancel function (P2-T20) calls it with 'cancelled'. Sets status and close_reason.
-- A completed close is refused while an accepted change request has not been deployed. Not callable
-- from the API. There is no retention date until go-live (D-303, G17).
create function private.close_project(p_project uuid, p_reason public.close_reason) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_reason = 'completed' and exists (
    select 1 from public.change_requests where project_id = p_project and status = 'accepted'
  ) then
    raise exception 'close_project: an accepted change request is not deployed yet';
  end if;
  update public.projects set status = 'closed', close_reason = p_reason where id = p_project;
end;
$$;
revoke all on function private.close_project(uuid, public.close_reason) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Stage runner: queue functions (P2-T04, D-278, D-301, D-302, D-305)
-- ---------------------------------------------------------------------------
-- The runner (the worker, holding the service key) and the console go through these five functions.
-- enqueue_run and request_run_cancel can be called by the owner; claim_run, heartbeat_run and finish_run
-- only by the worker (service_role): the grants allow nobody else and each body checks the role again.
-- A stale heartbeat is 10 minutes. A run is tried at most twice (attempts_limit). Waiting runs are not
-- re-queued: they wait on the owner and keep the project's slot (D-278).
-- Direct updates of stage_runs by the owner stay possible through the owner policy (go-live item G25).

-- Adds a queued run for the project's current stage. One queued run per project at a time.
create function enqueue_run(p_project uuid, p_stage stage) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v   public.projects%rowtype;
  rid uuid;
begin
  if not (private.is_owner() or auth.role() = 'service_role') then
    raise exception 'enqueue_run: not allowed';
  end if;
  select * into v from public.projects where id = p_project for update;
  if not found then
    raise exception 'enqueue_run: project not found';
  end if;
  if v.status <> 'active' then
    raise exception 'enqueue_run: project is %, only an active project can run', v.status;
  end if;
  if v.stage is distinct from p_stage then
    raise exception 'enqueue_run: project is in stage %, not %', v.stage, p_stage;
  end if;
  if exists (select 1 from public.stage_runs where project_id = p_project and status = 'queued') then
    raise exception 'enqueue_run: the project already has a queued run';
  end if;
  insert into public.stage_runs (project_id, stage) values (p_project, p_stage) returning id into rid;
  return rid;
end;
$$;
revoke all on function enqueue_run(uuid, stage) from public, anon, authenticated, service_role;
grant execute on function enqueue_run(uuid, stage) to authenticated, service_role;

-- Claims the oldest queued run whose project is active, still in the run's stage and has no active run,
-- in one statement, and returns it
-- (no row when there is nothing to do). First tidies runs whose worker went away (D-305): a running run
-- with no heartbeat for 10 minutes goes back to the queue, or fails when it has used both attempts; a
-- cancel_requested run with no heartbeat for 10 minutes is cancelled.
create function claim_run(p_worker text) returns setof public.stage_runs
language plpgsql security definer set search_path = '' as $$
declare
  r public.stage_runs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'claim_run: not allowed';
  end if;
  if p_worker is null or btrim(p_worker) = '' then
    raise exception 'claim_run: the worker needs a name';
  end if;

  update public.stage_runs
     set status = 'cancelled', finished_at = now()
   where status = 'cancel_requested'
     and coalesce(heartbeat_at, started_at, queued_at) < now() - interval '10 minutes';

  update public.stage_runs
     set status       = case when attempts < 2 then 'queued'::public.run_status else 'failed'::public.run_status end,
         claimed_by   = case when attempts < 2 then null else claimed_by end,
         heartbeat_at = case when attempts < 2 then null else heartbeat_at end,
         queued_at    = case when attempts < 2 then now() else queued_at end,
         finished_at  = case when attempts < 2 then null else now() end
   where status = 'running'
     and coalesce(heartbeat_at, started_at, queued_at) < now() - interval '10 minutes';

  -- A queued run that already used both attempts can never be claimed (attempts_limit); fail it so it
  -- cannot block the queue.
  update public.stage_runs set status = 'failed', finished_at = now()
   where status = 'queued' and attempts >= 2;

  select s.* into r
    from public.stage_runs s
   where s.status = 'queued'
     and exists (select 1 from public.projects p where p.id = s.project_id and p.status = 'active' and p.stage = s.stage)
     and not exists (
       select 1 from public.stage_runs a
        where a.project_id = s.project_id and a.status in ('running', 'waiting', 'cancel_requested')
     )
   order by s.queued_at, s.id
   limit 1
   for update of s skip locked;
  if not found then
    return;
  end if;

  begin
    update public.stage_runs
       set status = 'running', claimed_by = p_worker, heartbeat_at = now(),
           started_at = coalesce(started_at, now()), attempts = attempts + 1, finished_at = null
     where id = r.id
     returning * into r;
  exception when unique_violation then
    return; -- another claim took the project's slot first (D-278 backstop)
  end;
  return next r;
end;
$$;
revoke all on function claim_run(text) from public, anon, authenticated, service_role;
grant execute on function claim_run(text) to service_role;

-- Refreshes the heartbeat of a run this worker holds and returns its status, so the worker sees
-- cancel_requested (D-301). Returns null when the worker no longer holds the run: it must stop.
create function heartbeat_run(p_run uuid, p_worker text) returns public.run_status
language plpgsql security definer set search_path = '' as $$
declare
  st public.run_status;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'heartbeat_run: not allowed';
  end if;
  update public.stage_runs
     set heartbeat_at = now()
   where id = p_run and claimed_by = p_worker and status in ('running', 'waiting', 'cancel_requested')
   returning status into st;
  return st;
end;
$$;
revoke all on function heartbeat_run(uuid, text) from public, anon, authenticated, service_role;
grant execute on function heartbeat_run(uuid, text) to service_role;

-- Records the result of a run this worker holds and returns the status it ended in. A failed run with an
-- attempt left goes back to the queue (D-082: one automatic retry), unless the owner asked to cancel it:
-- then it ends cancelled. Tokens are added to the run's total.
create function finish_run(p_run uuid, p_worker text, p_status public.run_status, p_tokens bigint default 0)
returns public.run_status
language plpgsql security definer set search_path = '' as $$
declare
  r     public.stage_runs%rowtype;
  final public.run_status;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'finish_run: not allowed';
  end if;
  if p_status not in ('succeeded', 'failed', 'cancelled', 'stopped') then
    raise exception 'finish_run: % is not a final status', p_status;
  end if;
  if p_tokens < 0 then
    raise exception 'finish_run: tokens cannot be negative';
  end if;
  select * into r from public.stage_runs
   where id = p_run and claimed_by = p_worker and status in ('running', 'waiting', 'cancel_requested')
   for update;
  if not found then
    raise exception 'finish_run: this worker does not hold run %', p_run;
  end if;

  if p_status = 'failed' and r.status = 'cancel_requested' then
    final := 'cancelled';
  elsif p_status = 'failed' and r.attempts < 2 then
    final := 'queued';
  else
    final := p_status;
  end if;

  if final = 'queued' then
    update public.stage_runs
       set status = 'queued', claimed_by = null, heartbeat_at = null, queued_at = now(),
           tokens_used = tokens_used + p_tokens
     where id = r.id;
  else
    update public.stage_runs
       set status = final, finished_at = now(), tokens_used = tokens_used + p_tokens
     where id = r.id;
  end if;
  return final;
end;
$$;
revoke all on function finish_run(uuid, text, public.run_status, bigint) from public, anon, authenticated, service_role;
grant execute on function finish_run(uuid, text, public.run_status, bigint) to service_role;

-- The console's Cancel button (D-301): a queued run is cancelled at once; a running or waiting run becomes
-- cancel_requested and the worker stops it at its next heartbeat. Owner only.
create function request_run_cancel(p_run uuid) returns public.run_status
language plpgsql security definer set search_path = '' as $$
declare
  r     public.stage_runs%rowtype;
  final public.run_status;
begin
  if not private.is_owner() then
    raise exception 'request_run_cancel: not allowed';
  end if;
  select * into r from public.stage_runs where id = p_run for update;
  if not found then
    raise exception 'request_run_cancel: run not found';
  end if;
  if r.status = 'queued' then
    final := 'cancelled';
    update public.stage_runs set status = final, finished_at = now() where id = r.id;
  elsif r.status in ('running', 'waiting') then
    final := 'cancel_requested';
    update public.stage_runs set status = final where id = r.id;
  elsif r.status = 'cancel_requested' then
    final := r.status;
  else
    raise exception 'request_run_cancel: the run is already %', r.status;
  end if;
  return final;
end;
$$;
revoke all on function request_run_cancel(uuid) from public, anon, authenticated, service_role;
grant execute on function request_run_cancel(uuid) to authenticated;

-- The intake agent's review of a submitted round (P2-T05, D-077, D-079, D-006, D-275). The worker calls it
-- once, with the model's checked reply, and in one transaction it writes the review as the next immutable
-- intake_record artifact version, locks the round (reviewed), and opens the next round when there are
-- follow-up questions. A round is round 1 (the template) plus at most 3 follow-up rounds, so round 4 is the
-- last: it cannot ask for more, and its gap list is for the owner. The follow-up text lives in the artifact;
-- each follow-up is also a row of intake_responses (asked_by 'agent', the question text and no answer yet)
-- under the id fu<round>_<n>; the owner can remove it or add questions of their own (P2-T06).
create function complete_intake_review(
  p_project uuid, p_round int, p_summary text, p_gaps jsonb, p_followups jsonb, p_model text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  proj public.projects%rowtype;
  rnd  public.intake_rounds%rowtype;
  n    int;
  art  uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'complete_intake_review: not allowed';
  end if;
  select * into proj from public.projects where id = p_project for update;
  if not found then
    raise exception 'complete_intake_review: project not found';
  end if;
  if proj.status <> 'active' or proj.stage <> 'intake' then
    raise exception 'complete_intake_review: the project must be active and at the intake stage';
  end if;
  select * into rnd from public.intake_rounds where project_id = p_project and round = p_round for update;
  if not found then
    raise exception 'complete_intake_review: round % not found', p_round;
  end if;
  if rnd.status <> 'submitted' then
    raise exception 'complete_intake_review: only a submitted round can be reviewed (round % is %)', p_round, rnd.status;
  end if;
  if exists (select 1 from public.intake_rounds where project_id = p_project and round > p_round) then
    raise exception 'complete_intake_review: only the latest round can be reviewed';
  end if;
  if p_summary is null or btrim(p_summary) = '' then
    raise exception 'complete_intake_review: the review needs a summary';
  end if;
  if length(p_summary) > 1500 or length(coalesce(p_model, '')) > 100 then
    raise exception 'complete_intake_review: summary or model name too long';
  end if;
  if p_gaps is null or jsonb_typeof(p_gaps) <> 'array' then
    raise exception 'complete_intake_review: gaps must be a list';
  end if;
  if jsonb_array_length(p_gaps) > 40 then
    raise exception 'complete_intake_review: at most 40 gaps';
  end if;
  -- Gaps are stored in an immutable row, so each element is checked: an object with a text issue and an
  -- optional question id, nothing else, and bounded in length.
  if exists (
    select 1 from jsonb_array_elements(p_gaps) g
     where jsonb_typeof(g) <> 'object'
        or jsonb_typeof(g->'issue') is distinct from 'string'
        or btrim(g->>'issue') = '' or length(g->>'issue') > 1100
        or (g ? 'question_id' and (jsonb_typeof(g->'question_id') <> 'string' or length(g->>'question_id') > 100))
        or exists (select 1 from jsonb_object_keys(g) k where k not in ('issue', 'question_id'))
  ) then
    raise exception 'complete_intake_review: each gap needs a text issue (and may name a question id)';
  end if;
  if p_followups is null or jsonb_typeof(p_followups) <> 'array' then
    raise exception 'complete_intake_review: follow-ups must be a list';
  end if;
  n := jsonb_array_length(p_followups);
  if n > 8 then
    raise exception 'complete_intake_review: at most 8 follow-up questions (D-077)';
  end if;
  if p_round >= 4 and n > 0 then
    raise exception 'complete_intake_review: the cap of 3 follow-up rounds is reached; list the gaps for the owner instead (D-006)';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_followups) f
     where jsonb_typeof(f) <> 'object'
        or jsonb_typeof(f->'text') is distinct from 'string'
        or btrim(f->>'text') = '' or length(f->>'text') > 500
        or (f ? 'reason' and (jsonb_typeof(f->'reason') <> 'string' or length(f->>'reason') > 500))
        or exists (select 1 from jsonb_object_keys(f) k where k not in ('id', 'text', 'reason'))
        or jsonb_typeof(f->'id') is distinct from 'string'
        or (f->>'id') !~ ('^fu' || (p_round + 1) || '_[1-9][0-9]*$')
  ) then
    raise exception 'complete_intake_review: each follow-up needs text and an id like fu%_1', p_round + 1;
  end if;
  -- The ids are exactly fu<next>_1 to fu<next>_n, so they read in order and cannot repeat.
  if (select count(*) from jsonb_array_elements(p_followups) f
       where substring(f->>'id' from '_([0-9]+)$')::int between 1 and n) <> n then
    raise exception 'complete_intake_review: follow-up ids must run from fu%_1 to fu%_%', p_round + 1, p_round + 1, n;
  end if;
  if (select count(distinct f->>'id') from jsonb_array_elements(p_followups) f) <> n then
    raise exception 'complete_intake_review: follow-up ids must be unique';
  end if;

  insert into public.artifacts (project_id, type, version, status, content)
  values (
    p_project, 'intake_record',
    coalesce((select max(version) from public.artifacts where project_id = p_project and type = 'intake_record'), 0) + 1,
    'draft',
    jsonb_build_object(
      'round', p_round, 'summary', p_summary, 'gaps', p_gaps, 'followups', p_followups,
      'model', p_model, 'capped', p_round >= 4)
  )
  returning id into art;

  update public.intake_rounds set status = 'reviewed', reviewed_at = now() where id = rnd.id;
  if n > 0 then
    insert into public.intake_rounds (project_id, round) values (p_project, p_round + 1);
    insert into public.intake_responses (project_id, round, question_id, answer, asked_by, question)
    select p_project, p_round + 1, f->>'id', null, 'agent', f->>'text'
      from jsonb_array_elements(p_followups) f;
  end if;
  return art;
end;
$$;
revoke all on function complete_intake_review(uuid, int, text, jsonb, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function complete_intake_review(uuid, int, text, jsonb, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table owners            enable row level security;
alter table projects          enable row level security;
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
alter table gate_feedback      enable row level security;
alter table project_internal   enable row level security;

-- Owner: full access to every table except approvals (below).
do $$
declare t text;
begin
  foreach t in array array[
    'owners', 'projects', 'intake_templates', 'intake_responses', 'uploads', 'artifacts',
    'rounds', 'backlog_items', 'comments', 'change_requests', 'qc_runs',
    'skills_registry', 'stage_runs', 'gate_config', 'skill_uses',
    'intake_rounds', 'run_logs', 'owner_notes', 'prd_feedback', 'run_approvals', 'email_log',
    'project_internal'
  ] loop
    execute format(
      'create policy owner_all on %I for all to authenticated using (private.is_owner()) with check (private.is_owner())',
      t
    );
  end loop;
end $$;

-- Approvals: the owner reads them; nothing writes them through the API. Every approval is written by
-- accept_gate (P2-T18), which checks the stage, the current version, the order of the gates and the intake
-- rule, and records a client-gate approval (D-298) with its evidence note. Update and delete policies
-- exist only so that the append-only trigger answers with a clear error instead of silently touching
-- zero rows.
-- RLS does not bind the worker's role, so its table privilege goes too: only accept_gate (which runs as the
-- function owner) writes approvals.
-- TRUNCATE skips row-level security and the append-only row trigger, so it goes too (with trigger and
-- references, which no API role needs).
revoke insert, truncate, trigger, references on approvals from authenticated, service_role;
create policy owner_read_approvals on approvals
  for select to authenticated using (private.is_owner());
create policy owner_update_approvals on approvals
  for update to authenticated using (private.is_owner());
create policy owner_delete_approvals on approvals
  for delete to authenticated using (private.is_owner());

-- Gate feedback: the owner reads it; only feedback_gate() writes it (as approvals above). The worker reads
-- it with the service key to hand the notes to the agent.
revoke insert, update, delete, truncate, trigger, references on gate_feedback from authenticated, service_role;
create policy owner_read_gate_feedback on gate_feedback
  for select to authenticated using (private.is_owner());

-- Every other table has the owner_all policy only; there is no client policy until go-live (G15).

-- ---------------------------------------------------------------------------
-- Storage: the private bucket for intake uploads (P2-T03, D-075, D-100, D-211)
-- ---------------------------------------------------------------------------
-- The owner attaches the client's files in the console (D-298). The bucket is private; only the owner
-- reads or writes objects, and only inside a folder named after an existing project, which matches the
-- upload_path_in_project check on the uploads table. The bucket's own limits repeat the table's: 25 MB
-- and the allowed types (D-211's 5 MB cap for images is checked by the uploads table and the console).
-- The owner test in the check is repeated on purpose: the project lookup already hides every project from a
-- non-owner, so the check would refuse them anyway, and a later change to projects must not open the bucket.
-- (In the policy the object name is written objects.name: a bare name would mean projects.name inside the subquery.)
-- Files stay scan_status 'pending' until the malware scan exists (G-item); no agent opens them before.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake-uploads', 'intake-uploads', false, 26214400,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown', 'application/json', 'video/mp4'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only the first path segment is checked. Storage keys are flat strings, so a later ".." or an empty
-- segment cannot leave the project's folder. The 5 MB image cap and the file type are not enforced when the
-- object is written (the bucket allows 25 MB): the console checks them first, and the uploads table refuses
-- a row that breaks them, so an object whose row was refused is removed again by the console.
create policy owner_intake_objects on storage.objects
  for all to authenticated
  using (
    bucket_id = 'intake-uploads' and private.is_owner()
  )
  with check (
    bucket_id = 'intake-uploads' and private.is_owner()
    and exists (select 1 from public.projects p where p.id::text = (storage.foldername(objects.name))[1])
  );

-- anon is never used: remove what Supabase's default privileges granted it before the defaults
-- above took effect.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
