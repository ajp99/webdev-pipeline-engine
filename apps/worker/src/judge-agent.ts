// The eval judge (D-329): Opus 5.5 through the Agent SDK on the owner's Claude Code login, with no tools, one
// turn and no settings or API key from the environment. Returns the judge's text reply.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { childEnv } from './builder-host';
import type { Judge } from './eval-planner';

export const DEFAULT_JUDGE_MODEL = 'claude-opus-5-5';

export function judgeModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.EVAL_JUDGE_MODEL?.trim() || DEFAULT_JUDGE_MODEL;
}

export function agentJudge(model = judgeModel()): Judge {
  return async (prompt) => {
    let text = '';
    let failed: string | null = null;
    for await (const msg of query({
      prompt,
      options: {
        model,
        tools: [],
        disallowedTools: [
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'WebFetch',
          'WebSearch',
          'Task',
          'NotebookEdit',
        ],
        permissionMode: 'default',
        canUseTool: async () => ({ behavior: 'deny', message: 'the judge uses no tools' }),
        maxTurns: 1,
        settingSources: [],
        env: childEnv(),
      },
    })) {
      if (msg.type === 'result') {
        if (msg.subtype === 'success') text = msg.result;
        else failed = `the judge's session ended with ${msg.subtype}`;
      }
    }
    if (failed) throw new Error(failed);
    return text;
  };
}
