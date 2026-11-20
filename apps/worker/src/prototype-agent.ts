// The Prototype agent's Agent SDK session (P3-T04): the owner's Claude Code login, no API key (D-328), file tools
// only, every write checked by PROTOTYPE_WRITES.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { guardTool, PROTOTYPE_WRITES } from './builder-guard';
import { childEnv } from './builder-host';
import type { PrototypeDeps } from './prototype';

export const DEFAULT_PROTOTYPE_MODEL = 'claude-sonnet-5-5';
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

export function prototypeModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKER_PROTOTYPE_MODEL?.trim() || DEFAULT_PROTOTYPE_MODEL;
}

export function prototypeAgent(model = prototypeModel()): PrototypeDeps['agent'] {
  return async ({ dir, system, prompt, signal, progress, log }) => {
    const ac = new AbortController();
    if (signal.aborted) ac.abort();
    else signal.addEventListener('abort', () => ac.abort(), { once: true });
    let summary = '';
    let tokens = 0;
    let failed: string | null = null;
    for await (const msg of query({
      prompt,
      options: {
        cwd: dir,
        model,
        systemPrompt: system,
        abortController: ac,
        tools: TOOLS,
        disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit'],
        permissionMode: 'default',
        canUseTool: async (tool, input) => {
          const v = guardTool(dir, tool, input, PROTOTYPE_WRITES);
          log(
            v.allow ? 'debug' : 'warn',
            v.allow ? `allowed ${tool}` : `refused ${tool}: ${v.reason}`,
          );
          return v.allow
            ? { behavior: 'allow', updatedInput: input }
            : { behavior: 'deny', message: v.reason };
        },
        maxTurns: 40,
        settingSources: [],
        env: childEnv(),
      },
    })) {
      progress();
      if (msg.type === 'assistant') {
        for (const b of msg.message.content)
          if (b.type === 'tool_use') {
            const fp = (b.input as { file_path?: unknown } | null)?.file_path;
            log('info', `Prototype agent: ${b.name}${typeof fp === 'string' ? ` ${fp}` : ''}`);
          }
      } else if (msg.type === 'result') {
        tokens += (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0);
        if (msg.subtype === 'success') summary = msg.result;
        else failed = `the session ended with ${msg.subtype}`;
      }
    }
    if (signal.aborted) throw new Error('stopped');
    if (failed) throw new Error(failed);
    return { summary: summary.trim() || 'No summary given.', tokens, model };
  };
}
