# Architecture

## Request flow

```
Client (browser)
      |
      v
Next.js  ->  apps/web   (UI, routing, rendering)
      |
      v
NestJS   ->  apps/api   (HTTP API, business logic)
      |
      v
PostgreSQL              (persistence — NOT IMPLEMENTED YET)
```

> **PostgreSQL is not implemented yet.** The API holds no database, no ORM and no
> persistence layer. It currently answers from in-memory values only. The database
> arrives in phase 3 — see [ROADMAP.md](./ROADMAP.md).

## Repository layout

```
nexo/
├── apps/
│   ├── web/        Next.js frontend  (App Router, TypeScript, Tailwind CSS)
│   └── api/        NestJS backend    (TypeScript, ESM)
├── packages/
│   ├── config/     Shared configuration (currently a TypeScript base config)
│   └── types/      Types shared between frontend and backend
├── docs/           Product, requirements, architecture, conventions, roadmap
└── .github/        Reserved for CI/CD workflows (phase 13)
```

The monorepo is managed with **pnpm workspaces**. No task orchestrator (Turborepo,
Nx) is used: with two applications and two small packages, plain pnpm recursive
scripts are enough. That decision should be revisited only when build times or
cross-package dependencies actually justify it.

## Boundaries

- `apps/web` never talks to a database. It talks to `apps/api` over HTTP.
- `apps/api` owns all business logic and, from phase 3, all data access.
- `packages/*` hold code shared by both sides and must stay free of framework
  and business logic.

## Ports

| Service  | URL                     |
| -------- | ----------------------- |
| Frontend | `http://localhost:3000` |
| API      | `http://localhost:3001` |

The API reads `process.env.PORT` and falls back to `3001`.

## Shared types

`packages/types` is consumed as a **type-only** dependency:

```ts
import type { ApiStatus } from '@nexo/types';
```

Its `exports` map points TypeScript at the package source, so `typecheck` works
without building the package first, and type-only imports leave no trace in the
compiled JavaScript. Anything with a runtime value must not be added there
without revisiting this setup.

## Not in the architecture yet

Authentication, authorization, database, caching, queues, file storage, email,
real-time transport and containerization are all deliberately absent. They are
planned in [ROADMAP.md](./ROADMAP.md) and must not be introduced ahead of schedule.
