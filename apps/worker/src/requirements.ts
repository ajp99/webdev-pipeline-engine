// The requirements agent (P2-T07): reads the accepted intake, the owner's notes and the newest PRD, asks the
// model for the PRD and its owner-only gap and conflict list, checks the answer, and hands both to
// complete_stage_artifact. A plain JSON call, not an Agent SDK run (D-275). The client's Request changes notes
// (prd_feedback) are never read here: they go to the owner, who turns them into notes or edits (D-087).
import {
  buildRequirementsPrompt,
  parseRequirementsReply,
  REQUIREMENTS_JSON_SCHEMA,
  type PrdContent,
  type PrdNotes,
  type RequirementsInput,
} from '@wpe/shared';
import type { Handler } from './runner';
import { generateChecked, type ModelClient } from './model';
import { promptHash } from './prompt-hash';

export interface RequirementsDeps {
  /** What the agent reads, or null when there is nothing to draft (the stage moved on). */
  load(projectId: string): Promise<RequirementsInput | null>;
  /** complete_stage_artifact with the PRD and its notes. */
  write(a: {
    project: string;
    run: string;
    worker: string;
    content: PrdContent;
    notes: PrdNotes;
    model: string;
    promptHash?: string;
  }): Promise<void>;
}

export function requirementsHandler(deps: RequirementsDeps, model: ModelClient): Handler {
  return async ({ run, worker, signal, progress, log }) => {
    progress();
    const input = await deps.load(run.project_id);
    if (!input) {
      log('info', 'nothing to draft: the project is no longer at the requirements stage');
      return { tokens: 0 };
    }
    const { system, user } = buildRequirementsPrompt(input);
    const ctx = { hasPrevious: input.previous !== null, ownerNotes: input.ownerNotes };
    const { value, tokens } = await generateChecked(
      model,
      { system, user, schema: REQUIREMENTS_JSON_SCHEMA, signal, progress },
      (raw) => parseRequirementsReply(raw, ctx),
    );
    // A cancel that arrived while the model was thinking wins: nothing is written.
    if (signal.aborted) throw new Error('stopped');
    await deps.write({
      project: run.project_id,
      run: run.id,
      worker,
      content: value.content,
      notes: value.notes,
      model: model.name,
      promptHash: promptHash(system, REQUIREMENTS_JSON_SCHEMA),
    });
    log(
      'info',
      `wrote PRD ${input.previous ? 'revision' : 'first draft'} with ${value.notes.gaps.length} gaps and ${value.notes.conflicts.length} conflicts for the owner`,
    );
    progress();
    return { tokens };
  };
}
