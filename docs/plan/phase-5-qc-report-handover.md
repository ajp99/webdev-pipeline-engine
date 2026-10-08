# Phase 5: QC, report, handover

**Status:** not started

**Goal:** QC, the final report, deployment preparation, the handover pack, project close, and a real pilot site.

**Gate (owner accepts this phase when):** A pilot site is handed over.

**Spec to read:** [08-qc-and-report.md](../spec/08-qc-and-report.md), [09-deployment-and-handover.md](../spec/09-deployment-and-handover.md), [12-security.md](../spec/12-security.md), [13-cost.md](../spec/13-cost.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P5-T01 QC runner**  
  Acceptance: Lighthouse CLI (mobile) and Playwright on the key pages listed in the approved plan, run against a local production build the worker serves; basic SEO checks; the generic checklist (privacy policy, cookie notice and contact form checks); the contact form tested against a stubbed mail transport (validates, submits, returns success); a claim-marker check (every `<Claim>` marker belongs to a cleared claim); a single 80+ pass bar for every Lighthouse category; results stored in `qc_runs`.

- [ ] **P5-T02 Fix-list loop**  
  Acceptance: Failures become a fix list the owner approves; the Builder commits the fixes directly to `staging`; at most 2 fix loops; afterwards the report lists remaining issues for the owner to accept or fix manually.

- [ ] **P5-T03 Reporter, final screenshots and combined gate**  
  Acceptance: One concise report page; QC results and report are approved together in one soft gate. After acceptance the worker takes full-page desktop and mobile screenshots of the finished site (from the local build) and shares them with the client, who can view them and comment (a note comes to the owner; approval stays with the owner; no email).

- [ ] **P5-T04 Deployment preparation**  
  Acceptance: Production build verified on `staging`; a script strips all cleared claim markers; `staging` is merged into `main`, which Vercel deploys through its Git integration. The owner sets environment variables (including the form mailbox settings where the PRD calls for a form) and domains in Vercel from an agent-written checklist; an exact website DNS records and steps list (mail records only if the PRD names a provider that needs them); whether to go live on the Vercel address (set to noindex until the custom domain is attached) or wait for the domain is decided per project; a post-deploy smoke test that sends one real contact-form submission to a test address the owner sets, after which the owner switches the recipient to the client's. Hard gate.

- [ ] **P5-T05 Handover agent**  
  Acceptance: Documentation inside the client's fresh repo (a README and an editing guide, plus a PDF of the editing guide); the GitHub web-editor guide as one generic template with demo screenshots in written steps and a per-project list of content files; instructions for testing the contact form; the ownership transfer checklist; the handover document; maintenance notes; a statement that the client's Vercel project needs the plan Vercel requires for commercial use. Hard gate.

- [ ] **P5-T06 Project close**  
  Acceptance: The owner marks the handover complete (the client is not asked to confirm). That runs a final database export, revokes scoped tokens, moves the project to stage `closed` with status `closed` and reason `completed` in one `advance_stage()` call, and sets the retention date (default 90 days after close, adjustable per project). The client dashboard becomes read-only and shows only the handover guide and its PDF; client accounts stay active until the owner disables them. The owner offers a bug-fix window of about 30 days outside the pipeline.

- [ ] **P5-T07 Change requests during the live period**  
  Acceptance: Change requests apply from go-live until handover is marked complete; after close they are refused with a note that changes are handled outside the pipeline. Each request shows a status in the client dashboard (received, accepted, deferred, declined, deployed) with no email. An accepted request runs as a mini-round on a `cr-N` branch with a pull request into `staging` and the round checks only; the owner Accepts, the Builder writes a release-note artifact, and the owner's hard-gate deploy approval attaches to it before `staging` is merged into `main`. That approval is not a stage gate and never advances or closes the project.

- [ ] **P5-T08 Read-only MCP server (optional, deferred)**  
  Acceptance: Decided after the pilot, since the owner is not sure it is needed. If built: an MCP server that lets the owner ask Claude about status, the approval queue, the backlog and cost; it cannot approve, answer or change anything. This task is not required for the phase gate.

- [ ] **P5-T09 Pilot**  
  Acceptance: Run the owner's own site end to end up to deployment on the Vercel address, then hand it over to a second GitHub account (no custom domain), with the owner playing the client from a second email account. Measure token cost per project against the estimate in `docs/spec/13-cost.md`, owner time per stage, Feedback loops per gate, first-try Lighthouse pass, and defects found after go-live. Propose spec changes in `docs/proposals/` based on what was learned.

- [ ] **P5-T10 Handover script (owner-run)**  
  Acceptance: The client creates an empty GitHub repo and adds the owner. One command pushes a single clean commit to it (no round history, no pull requests, no `.pipeline/` notes) and has a dry-run mode. The client then creates their own Vercel project from the fresh repo, the owner deletes the old project, and the environment variables are re-entered from the handover document. The original repo and its pull requests stay with the owner.

- [ ] **P5-T11 Retention deletion job**  
  Acceptance: A scheduled worker job deletes uploads, intake data, reference screenshots, run logs and the project's `email_log` rows when a project's `retention_until` date arrives, with no confirmation step, then sets `data_deleted_at`. It does not remove client accounts. A test with a fixture project shows the data gone and the accounts kept; running it twice changes nothing.

- [ ] **P5-T12 Phase 5 gate evidence**  
  Acceptance: Record in `PROGRESS.md`: the pilot report against the pilot measures in `docs/spec/15-operations.md`, a cost report in tokens, and automated tests of the QC runner, the fix loop and a dry run of the handover script.

## Gate

The phase is done when: **A pilot site is handed over**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
