# Progress log

Append one entry per finished task, newest at the bottom. Format:

```
## YYYY-MM-DD P1-T03 Short title
- What changed: ...
- Evidence: command output, test result, or link
- Follow-ups or blockers: ...
```

---

## 2026-10-08 P1-T01 Set up tooling and workspaces
- What changed: pnpm workspaces with Next.js 16, React 19, Tailwind 4, TypeScript 6.0 (pinned; typescript-eslint does not support 7 yet), ESLint 10, Prettier, Vitest 5, yaml, supabase-js and @supabase/ssr; a minimal web page, a worker stub and a shared stage list with one test; `.prettierignore` keeps docs and spec files untouched.
- Evidence: `pnpm lint` clean; `pnpm -r typecheck` clean in 3 workspaces; `pnpm test` 1 passed; `pnpm --filter @wpe/web build` succeeds; `pnpm dev` serves the page.
- Follow-ups or blockers: local Supabase through the Supabase CLI and Docker is set up in P1-T08; the worker runs in WSL2 on the owner's laptop.
