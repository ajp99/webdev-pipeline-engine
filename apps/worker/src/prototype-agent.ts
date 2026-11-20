// The Prototype agent's Agent SDK session (P3-T04): the owner's Claude Code login, no API key (D-328), file tools
// only, every write checked by PROTOTYPE_WRITES.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { guardTool, PROTOTYPE_WRITES } from './builder-guard';
import { childEnv, usageTokens } from './builder-host';
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
        tokens += usageTokens(msg.usage);
        if (msg.subtype === 'success') summary = msg.result;
        else failed = `the session ended with ${msg.subtype}`;
      }
    }
    if (signal.aborted) throw new Error('stopped');
    if (failed) throw new Error(failed);
    return { summary: summary.trim() || 'No summary given.', tokens, model };
  };
}

/**
 * The end-to-end test's stand-in for the agent session (P3-T11): writes a fixed main page, so the rest of the
 * run (build, commit, preview, screenshots, artifact) is real. run-cli uses it only with WPE_E2E=1 and the
 * scripted model, so a real worker never does.
 */
export function scriptedPrototypeAgent(): PrototypeDeps['agent'] {
  return async ({ dir, progress }) => {
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    await writeFile(
      join(dir, 'content', 'pages', 'home.mdx'),
      [
        '---',
        'title: Family dentistry',
        'description: A calm family dental practice taking new patients.',
        '---',
        '',
        '<Hero title="Calm, friendly dentistry for the whole family" cta="Book a check-up" ctaHref="/contact">',
        '  Caring for local families <Claim>since 2010</Claim>.',
        '</Hero>',
        '',
        '<Features title="What we offer" items={[{ title: "Check-ups", text: "Regular care for every age." }, { title: "Cleaning", text: "Gentle hygiene visits." }]} />',
        '',
        '<CallToAction title="New patients welcome" label="Contact us" href="/contact" />',
        '',
      ].join('\n'),
    );
    progress();
    return {
      summary: 'Scripted prototype: a calm hero, two services and a call to action.',
      tokens: 0,
      model: 'scripted:e2e',
    };
  };
}
