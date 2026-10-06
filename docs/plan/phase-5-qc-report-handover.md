# Phase 5: QC, report, handover

**Status:** not started

**Goal:** QC, the final report, deployment preparation, the handover pack, project close, and a real pilot site.

**Gate (owner accepts this phase when):** A pilot site is handed over.

**Spec to read:** [08-qc-and-report.md](../spec/08-qc-and-report.md), [09-deployment-and-handover.md](../spec/09-deployment-and-handover.md), [12-security.md](../spec/12-security.md), [13-cost.md](../spec/13-cost.md)

Rules: work only on this phase's tasks; tick each box when its acceptance criteria are met and add an entry to [PROGRESS.md](PROGRESS.md). Ask the owner before schema changes or dependencies not named in a task. Spec files are read-only; propose changes in `docs/proposals/`.

## Tasks

- [ ] **P5-T01 QC runner**  
  Acceptance: Lighthouse CLI on key pages (mobile), basic SEO checks, the generic checklist (including privacy policy, cookie notice, and contact form spam protection), and the Playwright smoke test; results stored in `qc_runs`.

- [ ] **P5-T02 Fix-list loop**  
  Acceptance: Failures become a fix list for owner approval; at most 2 fix loops; afterwards the report lists remaining issues for the owner to accept or fix manually.

- [ ] **P5-T03 Reporter and combined gate**  
  Acceptance: One concise report page; QC results and report are approved together in one soft gate.

- [ ] **P5-T04 Deployment preparation**  
  Acceptance: Production build verified on `staging`; `staging` is merged into `main`, which Vercel deploys through its Git integration. The owner sets environment variables and domains in Vercel from an agent-written checklist; Resend sender configured; post-deploy smoke test; an exact DNS records and steps list. Hard gate.

- [ ] **P5-T05 Handover agent**  
  Acceptance: Documentation, GitHub web-editor guide with screenshots for the project's file layout, ownership transfer checklist, handover document, maintenance notes. Hard gate.

- [ ] **P5-T06 Project close**  
  Acceptance: Marking handover complete runs a final database export, revokes scoped tokens, sets the project to a read-only archive, and sets the retention date (default 90 days after close, adjustable per project); client accounts stay active until the owner disables them.

- [ ] **P5-T07 Change requests during live period**  
  Acceptance: Change requests apply from go-live until handover is marked complete; after close they are refused with a note that changes are handled outside the pipeline.

- [ ] **P5-T08 Read-only MCP server**  
  Acceptance: An MCP server lets the owner ask Claude about status, the approval queue, the backlog and cost. It cannot approve, answer or change anything.

- [ ] **P5-T09 Pilot**  
  Acceptance: Run the owner's own site end to end, with the owner playing the client from a second email account. Measure token cost per project against the estimate in `docs/spec/13-cost.md`, owner time per stage, Feedback loops per gate, first-try Lighthouse pass, and defects found after go-live. Propose spec changes in `docs/proposals/` based on what was learned.

## Gate

The phase is done when: **A pilot site is handed over**. Only the owner marks it done, by setting **Status** above to `done` and updating `docs/plan/README.md`.
