// The Builder's session for one build round (P4-T02, P4-T03, D-333): the owner's Claude Code login, file tools
// checked by ROUND_WRITES, and Bash checked by the command allowlist. A refused command is logged for the backlog
// and denied; a risky one pauses the run until the owner answers in the console.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { sep } from 'node:path';
import { guardTool, type WritePolicy } from './builder-guard';
import { childEnv, usageTokens } from './builder-host';
import { classifyCommand, type CommandContext } from './command-policy';

export const DEFAULT_BUILDER_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_BUILDER_HARD_MODEL = 'claude-opus-5-5';
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

export function builderModel(hard: boolean, env: NodeJS.ProcessEnv = process.env): string {
  return hard
    ? env.WORKER_BUILDER_HARD_MODEL?.trim() || DEFAULT_BUILDER_HARD_MODEL
    : env.WORKER_BUILDER_MODEL?.trim() || DEFAULT_BUILDER_MODEL;
}

const SITE_DIRS = ['app', 'components', 'content', 'lib', 'public', 'tests'];
const SITE_EXT = /\.(tsx|ts|css|mdx|md|json|svg)$/;

/** A round may write the site's own files and its notes and backlog; never config, lockfile, scripts or .git. */
export const ROUND_WRITES: WritePolicy = {
  agent: 'Builder',
  canWrite: (rel) => {
    const parts = rel.split(sep);
    if (parts.includes('.git') || parts.includes('node_modules')) return false;
    if (rel === `.pipeline${sep}NOTES.md` || rel === `.pipeline${sep}backlog.json`) return true;
    return SITE_DIRS.includes(parts[0] ?? '') && SITE_EXT.test(rel);
  },
  rule: 'site files under app/, components/, content/, lib/, public/ and tests/, plus .pipeline/NOTES.md and .pipeline/backlog.json',
};

export type RoundGateDeps = {
  dir: string;
  commands: CommandContext;
  /** Logs a refused command for the backlog (P4-T04). */
  refused: (command: string, reason: string) => Promise<void>;
  /** Records a pause request and waits for the owner's answer (P4-T03). */
  askOwner: (
    kind: 'delete_files' | 'rewrite_history',
    command: string,
  ) => Promise<'approved' | 'denied'>;
  log: (level: 'debug' | 'info' | 'warn', msg: string) => void;
};

type Permission =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

/** The permission check for every tool call of a round's session. */
export function roundToolGate(d: RoundGateDeps) {
  return async (tool: string, input: Record<string, unknown>): Promise<Permission> => {
    if (tool === 'Bash') {
      const cmd = typeof input.command === 'string' ? input.command : '';
      if (input.run_in_background)
        return { behavior: 'deny', message: 'commands run in the foreground only' };
      const v = classifyCommand(cmd, d.commands);
      if (v.verdict === 'allow') {
        d.log('info', `Builder: $ ${cmd}`);
        return { behavior: 'allow', updatedInput: input };
      }
      if (v.verdict === 'refuse') {
        d.log('warn', `Builder: refused $ ${cmd}: ${v.reason}`);
        await d.refused(cmd, v.reason);
        return {
          behavior: 'deny',
          message: `Refused and logged for the owner: ${v.reason}. Do not reword it.`,
        };
      }
      d.log('warn', `Builder: waiting for the owner: $ ${cmd} (${v.reason})`);
      const answer = await d.askOwner(v.kind, cmd);
      d.log('info', `Builder: the owner ${answer} $ ${cmd}`);
      return answer === 'approved'
        ? { behavior: 'allow', updatedInput: input }
        : {
            behavior: 'deny',
            message: 'The owner denied this command. Find another way or log it as a question.',
          };
    }
    const v = guardTool(d.dir, tool, input, ROUND_WRITES);
    d.log(v.allow ? 'debug' : 'warn', v.allow ? `allowed ${tool}` : `refused ${tool}: ${v.reason}`);
    return v.allow
      ? { behavior: 'allow', updatedInput: input }
      : { behavior: 'deny', message: v.reason };
  };
}

export type RoundSession = (a: {
  gate: RoundGateDeps;
  system: string;
  prompt: string;
  model: string;
  signal: AbortSignal;
  progress: () => void;
}) => Promise<{ summary: string; tokens: number; model: string }>;

export const roundBuilderSession: RoundSession = async ({
  gate,
  system,
  prompt,
  model,
  signal,
  progress,
}) => {
  const ac = new AbortController();
  if (signal.aborted) ac.abort();
  else signal.addEventListener('abort', () => ac.abort(), { once: true });
  let summary = '';
  let tokens = 0;
  let failed: string | null = null;
  const canUseTool = roundToolGate(gate);
  for await (const msg of query({
    prompt,
    options: {
      cwd: gate.dir,
      model,
      systemPrompt: system,
      abortController: ac,
      tools: TOOLS,
      disallowedTools: ['WebFetch', 'WebSearch', 'Task', 'NotebookEdit'],
      permissionMode: 'default',
      canUseTool,
      maxTurns: 120,
      settingSources: [],
      env: childEnv(),
    },
  })) {
    progress();
    if (msg.type === 'result') {
      tokens += usageTokens(msg.usage);
      if (msg.subtype === 'success') summary = msg.result;
      else failed = `the session ended with ${msg.subtype}`;
    }
  }
  if (signal.aborted) throw new Error('stopped');
  if (failed) throw new Error(failed);
  return { summary: summary.trim() || 'No summary given.', tokens, model };
};

type Rpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: { status: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/**
 * The worker's side of a pause (P4-T03): records the request, then polls until the owner answers. The heartbeat
 * keeps running meanwhile; a cancel (the signal) ends the wait. A request that disappears counts as denied.
 */
export function ownerApproval(
  db: Rpc,
  runId: string,
  worker: string,
  signal: AbortSignal,
  pollMs = 3000,
): RoundGateDeps['askOwner'] {
  return async (kind, command) => {
    const { data, error } = await db.rpc('request_run_approval', {
      p_run: runId,
      p_worker: worker,
      p_kind: kind,
      p_command: command.slice(0, 2000),
    });
    if (error) throw new Error(`could not ask the owner: ${error.message}`);
    const id = data as string;
    for (;;) {
      if (signal.aborted) throw new Error('stopped');
      const r = await db.from('run_approvals').select('status').eq('id', id).maybeSingle();
      if (r.error) throw new Error(r.error.message);
      if (!r.data || r.data.status === 'denied') return 'denied';
      if (r.data.status === 'approved') return 'approved';
      await new Promise((res) => setTimeout(res, pollMs));
    }
  };
}
