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
- **Frontend** — Next.js (App Router), React, TypeScript, Tailwind CSS,
  shadcn/ui, Lucide, TanStack Query, React Hook Form + Zod
- **Backend** — NestJS, TypeScript, Prisma, PostgreSQL
- **Auth** — Argon2id, JWT access tokens, rotating refresh tokens in an
  HttpOnly cookie, RBAC

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
                    authentication, security, frontend, conventions, roadmap
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

| Service | URL                     |
| ------- | ----------------------- |
| Web     | `http://localhost:3000` |
| API     | `http://localhost:3001` |

Or run them separately:

```bash
pnpm dev:web
pnpm dev:api
```

### Signing in

Nexo has no public registration — it is an internal platform. Before the first
sign-in you need a database and a password for the seeded owner:

```bash
pnpm prisma:migrate        # apply migrations
pnpm prisma:seed           # create the NovaTec organization and its owner
pnpm auth:bootstrap-owner  # set that owner a password (read from apps/api/.env)
```

Then open `http://localhost:3000` and sign in. The session is restored on reload
through an HttpOnly refresh cookie; the access token never leaves memory. Full
details in [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) and
[docs/DATABASE.md](./docs/DATABASE.md).

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e   # needs the test database; see docs/DATABASE.md
```

Copy `apps/web/.env.example` and `apps/api/.env.example` to `.env` in their
respective folders before configuring anything environment-specific.

## Status

🚧 Under active development.

Phase 5 of 13 complete: monorepo, PostgreSQL with Prisma, authentication with
sessions and RBAC, and the design system, application shell and sign-in screen.

No product features (clients, projects, tasks) are implemented yet — those pages
show an honest "in construction" state. See
[docs/ROADMAP.md](./docs/ROADMAP.md).

Contributors and AI agents must read [AGENTS.md](./AGENTS.md) before making changes.
