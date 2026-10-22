# Proposal: A free model provider for single-shot agent roles in development

- **Status:** accepted
- **Date:** 2026-10-22
- **Raised by:** Claude (agent), at the owner's request in chat
- **Task or spec reference:** P2-T05 (intake agent review); D-275, D-313; `docs/spec/04-intake.md` step 5; `docs/spec/06-agents-skills-tools.md` (agents table); `docs/spec/13-cost.md`

## Problem

D-313 says development agent runs use the owner's existing Anthropic key, and the spec names Haiku 4.5 for the intake review. The owner has no Anthropic API credit and does not want to buy any for development, and Anthropic has no free API tier. P2-T05 (and the later single-shot roles: Requirements, Planner, Reporter) cannot run until a model is available. Nothing is built yet for P2-T05, so no work is lost.

## Proposed change

1. Single-shot roles (D-275) call a model through one small provider-neutral function in `apps/worker`: it takes a system prompt, the input, a JSON schema and a model name, and returns schema-checked JSON plus the token counts. Two providers to start: `anthropic` and `gemini`. The provider and model come from `apps/worker/.env` (`MODEL_PROVIDER`, `MODEL_NAME`), so switching is a config change, not a code change.
2. Until go-live (D-263), the default provider is Gemini on the Google AI Studio free tier (a Flash model, no card). The key is `GEMINI_API_KEY` in `apps/worker/.env` only; it is never committed and never pasted into chat (the existing secrets rules).
3. Development uses fictional clients only (D-263, the eval fixtures), because the Gemini free tier may use prompts for model training outside the EU, UK and EEA. Real client text never goes to a free tier.
4. A reply that does not match the schema is retried once; after that the run fails to the owner's queue (the same rule as any failed run, P2-T04). A rate-limit answer (HTTP 429) is retried after the wait the provider names; it counts as a sign of life for the watchdog.
5. New go-live item (G29): before real clients, switch the single-shot roles to Anthropic (Haiku 4.5 as the spec says, D-313's key), re-run the agent evals, and record the cost.
6. If approved, the spec edits are exactly these, in their own spec-only PR:
   - D-313 (plus a new decision row beside it, numbered when approved): "Until go-live, single-shot agent roles may run on a free provider (Gemini, Google AI Studio free tier) through a provider-neutral client; Anthropic stays the go-live provider (G29). Only fictional client data is sent to a free tier."
   - `docs/spec/04-intake.md` step 5 and the `docs/spec/06-agents-skills-tools.md` Intake row: after "Haiku 4.5 to start" add "(in development: Gemini Flash on the free tier, per the new decision row)".
   - `docs/plan/phase-2-intake-and-prd.md` P2-T05: "(Haiku 4.5 to start)" gets the same note, and the `.env.example` gets `MODEL_PROVIDER`, `MODEL_NAME` and `GEMINI_API_KEY`.

Not changed by this proposal: the Builder, the Prototype agent and QC fixes (Agent SDK roles, Phase 3 onward) need Claude's tool use. Whether they can run on anything else is a separate decision, to be made before Phase 3.

## Options considered

- Option A (recommended): Gemini Flash on the free tier, through the provider-neutral client. No card; native JSON-schema output; limits (about 10 requests a minute, 250 a day on one reported figure) are far above this task's volume. Free-tier prompts may be used for training, so fictional data only.
- Option B: Groq (Llama 3.3 70B). No card, fast, no training on your data; JSON-schema support on the free models is unverified.
- Option C: Ollama on the owner's laptop. No key, no limits, no data leaves the machine; quality and speed depend on the laptop, and structured output from small models is less reliable.
- Option D: OpenRouter `:free` models. One key for many models; daily caps are low (reports differ, 50 to 200 requests) and JSON support varies by model.
- Option E: buy Anthropic credit and keep the spec as written. Highest fidelity to the spec; the owner has said no for development.
- Option F: pause P2-T05 until an Anthropic key exists. No spec change, but it blocks the Phase 2a gate.

## Impact

- Spec text, only if approved: D-313 and a new decision row in `DECISIONS.md`; `docs/spec/04-intake.md`; `docs/spec/06-agents-skills-tools.md`; `docs/plan/phase-2-intake-and-prd.md` (P2-T05); `docs/plan/go-live-readiness.md` (G29).
- Code: a small model client with two providers in `apps/worker`, `.env.example` entries, and the P2-T05 agent built on it. The evals in the plan (Phase 3) should run per provider.
- Risk: output quality and JSON reliability differ between providers. The schema check, one retry and the owner's review of every gap list limit the damage; the go-live switch to Anthropic is a re-evaluation, not a promise of identical results.

## Owner decision

Approved on 2026-10-22, in chat, by the owner: "Approve Option A as written (Recommended)", in answer to "Do you approve the proposal docs/proposals/2026-10-22-dev-model-provider.md?". The spec edits of item 6 were applied as decision D-316 in `DECISIONS.md`, the intake sentence in `docs/spec/04-intake.md`, the Intake row in `docs/spec/06-agents-skills-tools.md`, the P2-T05 line in the phase file, `apps/worker/.env.example` and go-live item G29. At the owner's request they went into the same pull request as this proposal (PR #38), not a separate spec-only one.
