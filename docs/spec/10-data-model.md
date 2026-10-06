# Data model (Supabase)

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

The core is a project row with a stage, plus append-only versioned artifacts and approval records. Row-level security limits clients to their own project's client-facing data. The draft SQL, including row-level security policies, is in `supabase/migrations/`.

| Table | Purpose | Key fields |
| --- | --- | --- |
| projects | One per client site | id, name, industry, intake_template_id, intake_template_snapshot, github_repo, vercel_project_id, stage, status (active, paused, closed), close_reason (completed or cancelled), cost_warn_threshold, retention_until, round_plan, created_at |
| clients | Client accounts (Supabase Auth users) | id, email, project_id |
| owners | Owner accounts (Supabase Auth users); membership decides the owner role | id, created_at |
| intake_templates | Versioned industry templates | id, industry, version, sections, status |
| intake_responses | Answers by round | project_id, round, question_id, answer, asked_by (template or agent) |
| uploads | Client assets | project_id, kind, storage_path, optional |
| artifacts | Versioned agent outputs (PRD, plan, report, handover docs) | project_id, type, version, content, status (draft, approved, superseded) |
| approvals | Immutable approval log | artifact_id, approved_by, role (owner or client), gate_type (soft, hard, client), at |
| rounds | Build rounds | project_id, number, scope, preview_url, branch, pr_number, pr_url, status (planned, building, in_review, approved) |
| backlog_items | Questions and assumptions from building | project_id, round, question, context, assumption, owner_answer, ask_client, client_answer, status (open, answered, assumption_accepted) |
| comments | Client comments on the prototype | project_id, body, owner_disposition (forwarded, change request, ignored) |
| change_requests | Post-lock scope changes | project_id, description, impact_note, decision |
| qc_runs | QC results | project_id, lighthouse scores, checklist results, run_at |
| skills_registry | Library index and per-project skills | name, path, scope (project, candidate, library, deprecated), project_id, version, generalization_report (JSONB), approved_by, approved_at |
| stage_runs | Durable queue and run log for the stage runner | project_id, stage, status (queued, running, succeeded, failed, cancelled), queued_at, claimed_by, heartbeat_at, attempts, log_ref, tokens_used, cost, started_at, finished_at |
| gate_config | Gate settings per stage | stage, project_id (empty = global default), gate_type, gatekeeper, escalate_after_hours |
| skill_uses | Optional good or bad marks on skill use | project_id, stage, skill, mark (good or bad), marked_at |

**Stages (project.stage):** intake, requirements, plan, prototype, build_rounds (one repeating stage; the round number is in rounds.number), qc_report, deploy_prep, handover, closed. A stage moves forward only when its artifact has an approval record. Paused is a project status, not a stage.
