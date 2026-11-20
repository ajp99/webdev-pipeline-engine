// The Builder's Agent SDK calls (D-275, D-280, D-310): one session that writes the page, and a short
// resume trial. The session signs in with the owner's Claude Code login on this computer, so the
// environment passed on never holds an API key. The Builder gets file tools only: no shell, no web.
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentResult, BuilderDeps, RunIo } from './builder';
import { guardTool } from './builder-guard';
import { childEnv, usageTokens } from './builder-host';

const BUILDER_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
const DENIED_TOOLS = ['Bash', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit'];
export const DEFAULT_BUILDER_MODEL = 'claude-sonnet-5-5';

export function builderModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKER_BUILDER_MODEL && env.WORKER_BUILDER_MODEL.trim() !== ''
    ? env.WORKER_BUILDER_MODEL
    : DEFAULT_BUILDER_MODEL;
}

function options(dir: string, io: RunIo, model: string, extra: Partial<Options> = {}): Options {
  const ac = new AbortController();
  if (io.signal.aborted) ac.abort();
  else io.signal.addEventListener('abort', () => ac.abort(), { once: true });
  return {
    cwd: dir,
    model,
    abortController: ac,
    tools: BUILDER_TOOLS,
    disallowedTools: DENIED_TOOLS,
    // Every tool call is asked about, and guardTool answers: file tools inside the project directory only,
    // writes only under app/ (builder-guard.ts). Nobody is at the keyboard to approve anything else.
    permissionMode: 'default',
    canUseTool: async (tool, input) => {
      const v = guardTool(dir, tool, input);
      io.log(
        v.allow ? 'debug' : 'warn',
        v.allow ? `allowed ${tool}` : `refused ${tool}: ${v.reason}`,
      );
      return v.allow
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: v.reason };
    },
    // No user or project settings, hooks or CLAUDE.md: the run sees only what this code gives it.
    settingSources: [],
    // The sign-in lives under HOME; no keys are passed (childEnv drops them).
    env: childEnv(),
    ...extra,
  };
}

/** Pulls what the owner needs from a stream message: the session id, a one-line note, and the final tokens. */
function read(
  msg: SDKMessage,
  io: RunIo,
  acc: { sessionId: string | null; tokens: number; failed: string | null },
) {
  io.progress();
  if ('session_id' in msg && typeof msg.session_id === 'string') acc.sessionId = msg.session_id;
  if (msg.type === 'assistant') {
    for (const block of msg.message.content) {
      if (block.type === 'tool_use') {
        const input = block.input as { file_path?: unknown } | null;
        const path = typeof input?.file_path === 'string' ? ` ${input.file_path}` : '';
        io.log('info', `Builder: ${block.name}${path}`);
      }
    }
  } else if (msg.type === 'result') {
    const u = msg.usage;
    acc.tokens += usageTokens(u);
    if (msg.subtype !== 'success') acc.failed = `the session ended with ${msg.subtype}`;
  }
}

export function agentDeps(
  env: NodeJS.ProcessEnv = process.env,
): Pick<BuilderDeps, 'build' | 'resumeTrial'> {
  const model = builderModel(env);
  return {
    async build({ dir, prompt, ...io }): Promise<AgentResult> {
      const acc = { sessionId: null as string | null, tokens: 0, failed: null as string | null };
      for await (const msg of query({
        prompt,
        options: options(dir, io, model, { maxTurns: 25, persistSession: true }),
      }))
        read(msg, io, acc);
      if (io.signal.aborted) throw new Error('stopped');
      if (acc.failed) throw new Error(acc.failed);
      return { sessionId: acc.sessionId, tokens: acc.tokens };
    },

    async resumeTrial({ dir, sessionId, ...io }) {
      const acc = { sessionId: null as string | null, tokens: 0, failed: null as string | null };
      let reply = '';
      for await (const msg of query({
        prompt: 'In one sentence, which file did you write in this session? Do not use any tool.',
        options: options(dir, io, model, { resume: sessionId, maxTurns: 1 }),
      })) {
        read(msg, io, acc);
        if (msg.type === 'result' && msg.subtype === 'success') reply = msg.result;
      }
      if (acc.failed) return { ok: false, note: acc.failed, tokens: acc.tokens };
      // The session remembered its work when the answer names the page.
      const ok = /page\.tsx/i.test(reply);
      return {
        ok,
        note: ok ? 'it named app/page.tsx' : `it answered: ${reply.slice(0, 120)}`,
        tokens: acc.tokens,
      };
    },
  };
}
