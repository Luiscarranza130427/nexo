# AGENTS.md

Rules for any AI agent or automated tool working in this repository.

**Read this file and `docs/` before modifying any code.** They define what Nexo
is, how it is built and what is deliberately not built yet.

- [docs/PRODUCT.md](./docs/PRODUCT.md) — what Nexo is and who it is for
- [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md) — MVP scope vs. future scope
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — structure and boundaries
- [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) — code style and naming
- [docs/ROADMAP.md](./docs/ROADMAP.md) — phase order; what is allowed right now

> `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are generated and re-created by
> `next dev`. They carry Next.js' own notes about this major version. Do not edit
> them by hand and do not delete them — they come back on the next `next dev` run.
> **This file, at the repository root, is the authoritative one.**

---

## The stack is fixed

| Layer    | Technology                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Monorepo | pnpm workspaces                                                                                                    |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS                                                              |
| Backend  | NestJS, TypeScript                                                                                                 |
| Planned  | PostgreSQL, Prisma, JWT + refresh tokens, RBAC, shadcn/ui, TanStack Query, React Hook Form, Zod, Playwright, CI/CD |

**Do not change the stack without authorization.** Do not swap a library for an
equivalent one, do not add an orchestrator (Turborepo, Nx), and do not introduce
anything from the "Planned" row before its phase in the roadmap.

## Commands

```bash
pnpm install        # install everything
pnpm dev            # run web + api together
pnpm dev:web        # frontend on http://localhost:3000
pnpm dev:api        # api on http://localhost:3001
pnpm lint
pnpm typecheck
pnpm build
```

---

## Rules

### 1. Read before writing

Read this file and `docs/` before modifying code. Understand the phase the
project is in before proposing anything.

### 2. Do not change the stack without authorization

Technology choices are recorded above and in `docs/ARCHITECTURE.md`. Changing one
is a decision for the project owner, not for an agent.

### 3. Do not install dependencies without checking they are really needed

Before adding a package, check whether the problem can be solved with what is
already installed, or with a small amount of local code. If a dependency is
genuinely needed, say why before adding it.

### 4. Check for an existing solution before creating a file

Search the repository first. Most "new" components, helpers and types already
have an equivalent somewhere.

### 5. Do not duplicate

No duplicated components, services, utilities or types. Types shared by frontend
and backend belong in `packages/types`.

### 6. Keep frontend and backend separate

`apps/web` and `apps/api` communicate over HTTP only. Neither imports the other's
internals.

### 7. Keep business logic out of visual components

Components render. Logic belongs in services, hooks or modules.

### 8. Do not use `any`

Use `unknown` plus a type guard, or model the type properly. If `any` is truly
unavoidable, keep it as narrow as possible and document the reason in a comment.

### 9. Never commit secrets

No keys, tokens, passwords or connection strings in Git — not in code, not in
tests, not in documentation. Real `.env` files are ignored and must stay ignored.

### 10. Keep `.env.example` up to date

Every new environment variable must appear in the relevant `.env.example` with a
safe placeholder value and a short comment.

### 11. Validate before finishing a task

```bash
pnpm lint
pnpm typecheck
pnpm build
```

All must pass. Run the tests too, once they exist. Never reach a green result by
disabling a rule or hiding an error — fix the cause.

### 12. Leave nothing behind

No leftover `TODO`s, no stray `console.log`, no dead code, no accidental mocks, no
forgotten test files, no commented-out blocks "just in case".

### 13. Follow Conventional Commits

`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `build:`, `ci:`.
Short, imperative, in English.

### 14. Stay inside the requested scope

Do exactly what was asked. Improvements you notice along the way should be
reported, not silently implemented.

### 15. Do not restructure large parts of the project without authorization

Moving directories, renaming packages or reorganizing modules requires explicit
approval.

### 16. Prioritize, in this order

Simplicity → maintainability → security → readability → consistency.

Clever code that is hard to follow is a defect, not an achievement.

### 17. Stop at important architectural decisions

If a task requires a decision that affects the architecture — a new layer, a new
dependency boundary, a data model change, a different rendering strategy — stop,
explain the options and the trade-offs, and wait for a decision before implementing.
