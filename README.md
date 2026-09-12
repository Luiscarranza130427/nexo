# Nexo

Internal Operations Platform.

> A NovaTec Product 🚀

## About

Nexo is an internal operations platform for NovaTec and other small teams. It is
being built to centralize clients, projects, tasks, team, documents, finances,
calendar, notifications and activity in one place.

See [docs/PRODUCT.md](./docs/PRODUCT.md) for the full description.

## Stack

- **Monorepo** — pnpm workspaces
- **Frontend** — Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend** — NestJS, TypeScript

## Project Structure

```
nexo/
├── apps/
│   ├── web/        Next.js frontend
│   └── api/        NestJS API
├── packages/
│   ├── config/     Shared configuration
│   └── types/      Types shared between frontend and backend
└── docs/           Product, requirements, architecture, database,
                    authentication, security, conventions, roadmap
```

## Development

Requires Node.js 20.9+ and pnpm.

```bash
pnpm install
```

Run both applications:

```bash
pnpm dev
```

Or run them separately:

```bash
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:3001
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Copy `apps/web/.env.example` and `apps/api/.env.example` to `.env` in their
respective folders before configuring anything environment-specific.

## Status

🚧 Under active development.

Phase 4 of 13 complete: monorepo, frontend and API skeletons, PostgreSQL with
Prisma, and authentication with sessions and RBAC. No product features (clients,
projects, tasks) are implemented yet — see [docs/ROADMAP.md](./docs/ROADMAP.md).

Setting up locally also needs a database and the first owner account:
[docs/DATABASE.md](./docs/DATABASE.md) and
[docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md).

Contributors and AI agents must read [AGENTS.md](./AGENTS.md) before making changes.
