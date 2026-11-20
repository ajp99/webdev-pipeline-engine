// The Planner run (P3-T03): reads the signed PRD, the intake's design answers, the reference sites, the skills
// library, the owner's notes and any previous plan with its Feedback; first refreshes the reference-site
// screenshots for the owner (P3-T12; a failure there never stops the plan); asks the model for the plan; checks
// it; and writes it through complete_stage_artifact with the prompt hash (D-283). A plain JSON call (D-275).
import {
  buildPlannerPrompt,
  parsePlannerReply,
  PLANNER_JSON_SCHEMA,
  type Plan,
  type PlannerInput,
} from '@wpe/shared';
import { generateChecked, type ModelClient } from './model';
import { promptHash } from './prompt-hash';
import type { Handler } from './runner';

export interface PlannerDeps {
  load(projectId: string): Promise<PlannerInput | null>;
  write(a: {
    project: string;
    run: string;
    worker: string;
    plan: Plan;
    model: string;
    promptHash: string;
  }): Promise<void>;
  /** Takes and stores the reference-site screenshots; returns a line for the run log. */
  captureReferences?(projectId: string, urls: string[]): Promise<string>;
}

export function plannerHandler(deps: PlannerDeps, model: ModelClient): Handler {
  return async ({ run, worker, signal, progress, log }) => {
    progress();
    const input = await deps.load(run.project_id);
    if (!input) {
      log('info', 'nothing to plan: the project is no longer at the plan stage');
      return { tokens: 0 };
    }
    if (deps.captureReferences && input.references.length > 0) {
      try {
        log(
          'info',
          await deps.captureReferences(
            run.project_id,
            input.references.map((r) => r.url),
          ),
        );
      } catch (e) {
        log('warn', `reference screenshots skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
      progress();
    }
    const { system, user } = buildPlannerPrompt(input);
    const skillIds = input.skills.map((s) => s.id);
    const { value, tokens } = await generateChecked(
      model,
      { system, user, schema: PLANNER_JSON_SCHEMA, signal, progress },
      (raw) => parsePlannerReply(raw, skillIds),
    );
    if (signal.aborted) throw new Error('stopped');
    await deps.write({
      project: run.project_id,
      run: run.id,
      worker,
      plan: value,
      model: model.name,
      promptHash: promptHash(system, PLANNER_JSON_SCHEMA),
    });
    const hard = value.rounds.filter((r) => r.hard).length;
    log(
      'info',
      `wrote a plan of ${value.rounds.length} rounds (${hard} flagged hard), ${value.total_token_budget} tokens in all`,
    );
    progress();
    return { tokens };
  };
}
