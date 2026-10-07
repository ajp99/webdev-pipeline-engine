# Intake system

> Originally a snapshot of the Claude Doc "CreatePipeline Engine: Locked Spec" (2026-10-05). The repo is the source of truth; this file includes the owner-approved decisions D-038 to D-069 recorded in `DECISIONS.md`. Agents must not edit files in `docs/spec/`; propose changes in `docs/proposals/` (see `AGENTS.md`).

Intake is a multi-step, multi-round form: an industry template sets the baseline questions, and an agent adds follow-ups only where answers are vague or contradictory.

1. The owner creates the project, picks an industry (or asks the agent to generate a new template from the industry name plus the owner's notes), and enters the client's email. The client gets an invite email with a link to set a password.
2. Round 1: the client completes the template, one section per step with a progress bar. Answers save as the client goes. The generic template includes a design section: 4 style cards (pick 1 or 2) and layout density; up to 3 reference sites with what the client likes about each; colors and font styles with an optional brand guideline upload; imagery style and things to avoid. It also asks about an existing website (one text question) and requires a logo upload or an explicit answer that there is none. A controlled tool screenshots only the listed reference sites for the agent and the owner. The plan turns these answers into a design brief. Fields the owner marked `required` in the template must be filled before submitting; everything else is optional, and missing items are flagged, not blocking.
3. Optional uploads: logo, favicon, imagery, existing copy, links. Allowed types are PNG, JPEG, WebP, SVG (sanitized), PDF, DOCX, plain text, markdown, JSON and MP4, up to 25 MB each. Zip files are not allowed. Uploads are scanned for malware before any agent sees them, and agents never open documents with macros.
4. The client submits the round explicitly and can reopen it until the agent has reviewed it.
5. The agent (Haiku 4.5 to start, moving up if quality is poor) reviews the whole submitted round in one batch and posts at most 8 targeted follow-up questions (vague goals, undefined terms, conflicting requirements). After the review the round is locked: the client cannot change those answers.
6. A follow-up round unlocks for the client, who answers the follow-ups and may also change earlier answers. After submitting, the agent reviews again and the round locks again. The cap is 3 follow-up rounds; then the agent flags remaining gaps to the owner.
7. The owner reviews the full intake record and may edit client answers (the edit overwrites the answer, with no history), send a round back to the agent for another review, and add or remove questions, before accepting intake.

**Round states:** open, submitted, reviewed (locked). Only the owner can unlock a reviewed round.

**Industry template lifecycle:** the agent drafts a template for a new industry, the owner edits it as text (markdown or JSON) in the console and approves it, and it joins the template library. Templates are versioned. When a project starts, the template's sections are copied into the project, so it keeps the version it started with.

**Client emails:** the client is emailed (in English, once per event, no reminders) when intake follow-ups are ready.
