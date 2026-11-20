// The Builder's command allowlist (P4-T02, P4-T03, D-130, D-286). Every Bash call is classified before it runs:
// allowed, refused (the reason goes to the backlog), or paused for the owner (deleting a directory or many
// files, rewriting git history). Shell syntax is not interpreted: anything that would chain, redirect,
// substitute or expand is refused outright, so a refused command cannot be reworded through the shell.
// Paths must stay inside the project directory. The only network a command may reach is the package registry
// through `pnpm install --frozen-lockfile` and `pnpm add` of an allowed package.
export type CommandVerdict =
  | { verdict: 'allow' }
  | { verdict: 'refuse'; reason: string }
  | { verdict: 'pause'; kind: 'delete_files' | 'rewrite_history'; reason: string };

export type CommandContext = {
  /** Package names the approved plan names or the curated allowlist holds (D-286). */
  allowedPackages: ReadonlySet<string>;
  /** The round's branch, the only one the Builder may push (`round-N`). */
  roundBranch: string;
};

/** Files a plain rm may remove before it needs the owner. */
export const RM_FILE_LIMIT = 5;

const allow = (): CommandVerdict => ({ verdict: 'allow' });
const refuse = (reason: string): CommandVerdict => ({ verdict: 'refuse', reason });
const pause = (kind: 'delete_files' | 'rewrite_history', reason: string): CommandVerdict => ({
  verdict: 'pause',
  kind,
  reason,
});

// Characters that make the shell do more than run one program with literal arguments. Outside quotes all of
// these are refused; inside double quotes only those the shell still acts on ($, `, \); single quotes are literal.
const SHELL_SYNTAX = /[;&|`$<>(){}\\\n\r*?![\]~#]/;
const DOUBLE_QUOTED_SYNTAX = /[$`\\]/;

/**
 * Splits a command into words, honouring single and double quotes. Returns an error when the quoting is not
 * closed or when the shell would do more than pass literal words (see SHELL_SYNTAX).
 */
export function splitWords(cmd: string): { words: string[] } | { error: string } {
  const words: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let started = false;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else if (quote === '"' && DOUBLE_QUOTED_SYNTAX.test(ch))
        return { error: 'no variables, substitution or escapes inside double quotes' };
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === ' ' || ch === '\t') {
      if (started) words.push(cur);
      cur = '';
      started = false;
    } else if (SHELL_SYNTAX.test(ch)) {
      return {
        error:
          'one plain command at a time: no chaining, pipes, redirects, substitution, variables or wildcards',
      };
    } else {
      cur += ch;
      started = true;
    }
  }
  if (quote) return { error: 'the quoting is not closed' };
  if (started) words.push(cur);
  return { words };
}

/** A path argument must be relative and stay inside the project directory. */
function pathProblem(arg: string): string | null {
  if (arg.startsWith('/')) return `${arg} is an absolute path`;
  if (arg.split('/').includes('..')) return `${arg} leaves the project directory`;
  if (/(^|\/)\.env|(^|\/)\.git(\/|$)|(^|\/)\.wpe-/.test(arg))
    return `${arg} is not available to the Builder`;
  return null;
}

const FILE_TOOLS = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'pwd',
  'mkdir',
  'touch',
  'cp',
  'mv',
  'diff',
  'echo',
]);
const SEARCH_TOOLS = new Set(['grep', 'rg']);
const PNPM_SCRIPTS = new Set([
  'build',
  'lint',
  'typecheck',
  'test',
  'check:content',
  'format',
  'format:check',
]);
const GIT_READ = new Set([
  'status',
  'diff',
  'log',
  'show',
  'rev-parse',
  'ls-files',
  'add',
  'restore',
  'stash',
  'merge',
  'switch',
  'checkout',
  'mv',
]);
const GIT_REWRITE = new Set([
  'rebase',
  'filter-branch',
  'filter-repo',
  'update-ref',
  'replace',
  'reflog',
  'gc',
  'prune',
]);

export function classifyCommand(cmd: string, ctx: CommandContext): CommandVerdict {
  const trimmed = cmd.trim();
  if (!trimmed) return refuse('an empty command');
  const split = splitWords(trimmed);
  if ('error' in split) return refuse(split.error);
  if (split.words.length === 0) return refuse('an empty command');
  const [prog, ...args] = split.words as [string, ...string[]];
  if (prog.includes('/')) return refuse(`run programs by name, not by path (${prog})`);
  if (prog.includes('=')) return refuse('environment variables cannot be set on a command');

  if (FILE_TOOLS.has(prog) || SEARCH_TOOLS.has(prog)) {
    // For grep and rg the first non-option word is the pattern, not a path.
    let skipped = !SEARCH_TOOLS.has(prog);
    for (const a of args) {
      if (a.startsWith('-')) continue;
      if (!skipped) {
        skipped = true;
        continue;
      }
      const p = pathProblem(a);
      if (p) return refuse(p);
    }
    return allow();
  }
  if (prog === 'find') {
    if (args.some((a) => a === '-delete'))
      return pause('delete_files', 'find -delete removes files');
    if (args.some((a) => /^-(exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/.test(a)))
      return refuse('find may not run other programs or write files');
    for (const a of args.filter((x) => !x.startsWith('-')).slice(0, 1)) {
      const p = pathProblem(a);
      if (p) return refuse(p);
    }
    return allow();
  }
  if (prog === 'rm' || prog === 'rmdir') {
    const files = args.filter((a) => !a.startsWith('-'));
    for (const f of files) {
      const p = pathProblem(f);
      if (p) return refuse(p);
    }
    if (files.length === 0) return refuse('rm needs a file');
    if (prog === 'rmdir' || args.some((a) => /^-(-recursive|[a-zA-Z]*[rRd][a-zA-Z]*)$/.test(a)))
      return pause('delete_files', `removes a directory: ${files.join(' ')}`);
    if (files.length > RM_FILE_LIMIT) return pause('delete_files', `removes ${files.length} files`);
    return allow();
  }
  if (prog === 'git') return classifyGit(args, ctx);
  if (prog === 'pnpm') return classifyPnpm(args, ctx);
  return refuse(`${prog} is not on the Builder's command allowlist`);
}

function classifyGit(args: string[], ctx: CommandContext): CommandVerdict {
  const [sub, ...rest] = args;
  if (!sub || sub.startsWith('-'))
    return refuse(
      'git options before the subcommand (-c, -C, --git-dir, --exec-path) are not allowed',
    );
  for (const a of rest) {
    if (/^--(exec|upload-pack|receive-pack|git-dir|work-tree)/.test(a))
      return refuse(`git ${a} is not allowed`);
  }
  if (GIT_REWRITE.has(sub)) return pause('rewrite_history', `git ${sub} rewrites history`);
  if (sub === 'commit') {
    if (rest.includes('--amend'))
      return pause('rewrite_history', 'git commit --amend rewrites the last commit');
    return allow();
  }
  if (sub === 'reset') {
    const files = rest.filter((a) => !a.startsWith('-'));
    if (
      rest.some((a) => /^--(hard|soft|mixed|keep|merge)$/.test(a)) ||
      files.some((f) => /^(HEAD|[0-9a-f]{7,40})/.test(f))
    )
      return pause('rewrite_history', 'git reset moves the branch');
    return allow();
  }
  if (sub === 'branch') {
    if (rest.some((a) => /^-(d|D|f|m|M|-delete|-force|-move)$/.test(a)))
      return pause('rewrite_history', 'deleting, forcing or renaming a branch');
    return allow();
  }
  if (sub === 'rm') {
    const files = rest.filter((a) => !a.startsWith('-'));
    if (rest.some((a) => /^-[a-zA-Z]*r/.test(a)))
      return pause('delete_files', 'git rm -r removes a directory');
    if (files.length > RM_FILE_LIMIT)
      return pause('delete_files', `git rm removes ${files.length} files`);
    return allow();
  }
  if (sub === 'push') {
    if (
      rest.some(
        (a) =>
          /^(-f|--force|--force-with-lease|--force-if-includes|--mirror|--delete|-d)$/.test(a) ||
          a.startsWith('+'),
      )
    )
      return pause('rewrite_history', 'a forced push or a branch deletion');
    const refs = rest.filter((a) => !a.startsWith('-'));
    const opts = rest.filter((a) => a.startsWith('-'));
    if (opts.some((o) => o !== '-u' && o !== '--set-upstream'))
      return refuse('git push takes only -u');
    if (refs.length === 2 && refs[0] === 'origin' && refs[1] === ctx.roundBranch) return allow();
    return refuse(`the Builder pushes only ${ctx.roundBranch} to origin, never main or staging`);
  }
  if (GIT_READ.has(sub)) return allow();
  return refuse(`git ${sub} is not on the Builder's command allowlist`);
}

/** A package spec's name without its version (`@scope/name@1.2.3` gives `@scope/name`). */
export function packageName(spec: string): string {
  const at = spec.lastIndexOf('@');
  return at > 0 ? spec.slice(0, at) : spec;
}

function classifyPnpm(args: string[], ctx: CommandContext): CommandVerdict {
  const [sub, ...rest] = args;
  if (!sub) return refuse('pnpm needs a command');
  if (sub === 'install' || sub === 'i') {
    if (!rest.includes('--frozen-lockfile')) return refuse('installs use --frozen-lockfile');
    if (rest.some((a) => !/^--(frozen-lockfile|prefer-offline|offline)$/.test(a)))
      return refuse('pnpm install takes only --frozen-lockfile, --prefer-offline or --offline');
    return allow();
  }
  if (sub === 'add') {
    const pkgs = rest.filter((a) => !a.startsWith('-'));
    if (rest.some((a) => a.startsWith('-') && !/^(-D|--save-dev|-E|--save-exact)$/.test(a)))
      return refuse('pnpm add takes only -D and -E');
    if (pkgs.length === 0) return refuse('pnpm add needs a package');
    for (const p of pkgs) {
      if (
        /^(file:|link:|git|https?:|\.|github:)/.test(p) ||
        (p.includes('/') && !p.startsWith('@'))
      )
        return refuse(`${p} is not a registry package`);
    }
    const unknown = pkgs.map(packageName).filter((n) => !ctx.allowedPackages.has(n));
    if (unknown.length)
      return refuse(
        `not in the plan or on the package allowlist, needs the owner's approval (D-286): ${unknown.join(', ')}`,
      );
    return allow();
  }
  if (sub === 'remove' || sub === 'rm')
    return rest.length ? allow() : refuse('pnpm remove needs a package');
  if (sub === 'run' ? PNPM_SCRIPTS.has(rest[0] ?? '') : PNPM_SCRIPTS.has(sub)) return allow();
  if (sub === 'exec') {
    const [tool, ...targs] = rest;
    if (tool === 'playwright' && targs[0] === 'test') return allow();
    if (
      tool === 'tsc' ||
      tool === 'eslint' ||
      tool === 'prettier' ||
      (tool === 'vitest' && targs[0] === 'run')
    ) {
      for (const a of targs.filter((x) => !x.startsWith('-'))) {
        const p = pathProblem(a);
        if (p) return refuse(p);
      }
      return allow();
    }
    if (tool === 'lighthouse') {
      const url = targs.find((a) => !a.startsWith('-')) ?? '';
      return /^http:\/\/(localhost|127\.0\.0\.1):\d+(\/[\w./-]*)?$/.test(url)
        ? allow()
        : refuse('lighthouse runs only against the local preview');
    }
    return refuse(`pnpm exec ${tool ?? ''} is not on the Builder's command allowlist`);
  }
  return refuse(`pnpm ${sub} is not on the Builder's command allowlist`);
}
