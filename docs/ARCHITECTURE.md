# Architecture

## Request flow

```
Browser
   |
   v
Next.js   ->  apps/web   (UI, routing, rendering)
   |
   v  HTTP
NestJS    ->  apps/api   (HTTP API, business logic)
   |
   v
Prisma                   (data access, query building)
   |
   v
PostgreSQL               (persistence)
```

Three rules hold this together:

- **The frontend never accesses PostgreSQL directly.** It only calls the API over HTTP.
- **The frontend never imports Prisma.** Prisma is a backend dependency and is
  installed only in `apps/api`.
- **All persistence logic goes through the API.** There is no second path to the data.

## Repository layout

```
nexo/
├── apps/
│   ├── web/                  Next.js frontend (App Router, TypeScript, Tailwind CSS)
│   └── api/                  NestJS backend (TypeScript, ESM)
│       ├── prisma/
│       │   ├── schema.prisma     Data model
│       │   ├── migrations/       Committed migration history
│       │   └── seed.ts           Idempotent development seed
│       ├── prisma.config.ts      Prisma 7 CLI configuration
│       └── src/
│           ├── database/         DatabaseModule + PrismaService
│           └── generated/        Prisma Client (generated, not committed)
├── packages/
│   ├── config/               Shared configuration (TypeScript base config)
│   └── types/                Types shared between frontend and backend
├── docs/                     Product, requirements, architecture, database, conventions, roadmap
└── .github/                  Reserved for CI/CD workflows (phase 13)
```

The monorepo is managed with **pnpm workspaces**. No task orchestrator (Turborepo,
Nx) is used: with two applications and two small packages, plain pnpm recursive
scripts are enough. That decision should be revisited only when build times or
cross-package dependencies actually justify it.

## Boundaries

- `apps/web` never talks to a database and never imports Prisma. It talks to
  `apps/api` over HTTP.
- `apps/api` owns all business logic and all data access. `DatabaseModule` is the
  only place that constructs a Prisma Client; `PrismaService` is injected wherever
  data access is needed.
- `packages/*` hold code shared by both sides and must stay free of framework,
  business and persistence logic. In particular, **`packages/types` must never
  re-export Prisma types** — its contents are public API contracts, which evolve
  independently of the database schema.

## Data layer

See [DATABASE.md](./DATABASE.md) for the data model, indexes, delete behaviour and
migration workflow. In short:

- **PostgreSQL** with **Prisma 7**, using the `@prisma/adapter-pg` driver adapter.
- `Organization` is the tenant boundary, preparing Nexo for multi-tenant SaaS use
  without a redesign.
- UUID primary keys throughout, mapped to the native PostgreSQL `uuid` type.
- Real migration history; `prisma db push` is not used as a substitute.

## Configuration

Environment variables are read once by `@nestjs/config` (`ConfigModule.forRoot`)
and reached through `ConfigService`. Modules do not read `process.env` directly.
`apps/api/.env` is gitignored; `apps/api/.env.example` documents the required
variables with placeholder values.

## Ports

| Service  | URL                     |
| -------- | ----------------------- |
| Frontend | `http://localhost:3000` |
| API      | `http://localhost:3001` |

The API reads `process.env.PORT` and falls back to `3001`.

## Health endpoints

| Endpoint         | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| `GET /`          | API identity and status.                                   |
| `GET /health`    | The process is up.                                         |
| `GET /health/db` | PostgreSQL actually answers a query. 503 when it does not. |

Failures never expose connection strings, driver messages or stack traces.

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

Authentication, authorization, caching, queues, file storage, email, real-time
transport and containerization are all deliberately absent. They are planned in
[ROADMAP.md](./ROADMAP.md) and must not be introduced ahead of schedule.
