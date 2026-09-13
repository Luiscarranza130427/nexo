# Database

## Engine

**PostgreSQL.** Development uses a local database named `nexo_dev`.

## ORM

**Prisma 7.** The schema lives in `apps/api/prisma/schema.prisma`; CLI settings
(schema path, migrations path, seed command, datasource URL) live in
`apps/api/prisma.config.ts`, which is where Prisma 7 expects them.

Prisma belongs to the backend only. `apps/web` never imports Prisma and never
talks to PostgreSQL — see [ARCHITECTURE.md](./ARCHITECTURE.md).

## ID strategy

Every model uses a `String` id with `@default(uuid())` mapped to the native
PostgreSQL `uuid` column type via `@db.Uuid`. One strategy, applied everywhere —
no mixing of autoincrement integers and UUIDs.

## Multi-organization strategy

`Organization` is the **tenant boundary**. Every business entity carries an
`organizationId`, so Nexo can become a multi-tenant SaaS later without redesigning
the schema.

What is intentionally **not** implemented yet: row level security, subdomain
routing, per-tenant connections, and tenant-aware query middleware. Today the
boundary exists in the data model only; enforcing it is part of phase 4.

`Task` carries `organizationId` even though it could be derived through
`Project`. That denormalization is deliberate: it lets every tenant-scoped query
filter without a join. The application is responsible for keeping a task's
`organizationId` equal to its project's.

## Models

| Model           | Purpose                                                               |
| --------------- | --------------------------------------------------------------------- |
| `Organization`  | A company or team using Nexo. The tenant boundary.                    |
| `User`          | A person who uses Nexo. No credentials yet — those arrive in phase 4. |
| `Membership`    | Links a user to an organization with a role.                          |
| `Client`        | A customer of the organization.                                       |
| `Project`       | Work delivered by the organization, optionally for a client.          |
| `ProjectMember` | A user assigned to a project.                                         |
| `Task`          | A unit of work inside a project.                                      |
| `Session`       | A revocable refresh-token session. One row per active login.          |

### Entity notes

- **Organization** — `slug` is globally unique and will become the tenant handle.
  `status` is `ACTIVE` / `INACTIVE`. `projectCodeSequence` is the counter behind project codes: incremented
  atomically when a project is created and never decremented, so a code is never
  reused. See [PROJECTS.md](./PROJECTS.md).
- **User** — `email` is globally unique. `passwordHash` holds an Argon2id hash and
  is **nullable**: an invited user exists before setting a password, and the seed
  deliberately creates the owner without one. It never leaves the backend. There
  are still no `refreshToken` or OAuth fields. `status` is `ACTIVE`, `INACTIVE` or
  `INVITED`, so a user can exist before accepting an invitation.
- **Membership** — roles are `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`. A user cannot
  join the same organization twice.
- **Client** — `type` is `PERSON` or `COMPANY`. `documentType`, `documentNumber`,
  `email`, `phone` and `address` are all optional, because a prospect is often
  captured with a name and nothing else.
- **Project** — `code` is the human-readable identifier (e.g. `NEX-001`), unique
  per organization rather than globally. `clientId` is optional: internal projects
  have no client. The API generates the code; clients never send it.
- **ProjectMember** — a plain join record. It has no role of its own yet; project
  permissions derive from `Membership` until a real need appears.
- **Task** — `position` is a manual ordering slot for a future Kanban board.
  `completedAt` is separate from `status` so completion time survives status edits.
- **Session** — the server-side half of a login, which is what makes a refresh
  token revocable. Stores a SHA-256 fingerprint of the current refresh token,
  never the token itself. `userAgent` and `ipAddress` are recorded for auditing;
  `revokedAt` marks logout or detected reuse. It carries `organizationId` because
  a session is scoped to one organization context at a time — switching
  organization moves the session. See [AUTHENTICATION.md](./AUTHENTICATION.md).

## Relationships

```
Organization
├── Membership
├── Client
├── Project
├── Task
└── Session

User
├── Membership
├── ProjectMember
├── Task (as assignee)
└── Session

Client
└── Project

Project
├── ProjectMember
└── Task
```

### Entity–relationship diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ MEMBERSHIP : has
    ORGANIZATION ||--o{ CLIENT : owns
    ORGANIZATION ||--o{ PROJECT : owns
    ORGANIZATION ||--o{ TASK : owns
    USER ||--o{ MEMBERSHIP : belongs_to
    USER ||--o{ PROJECT_MEMBER : participates_in
    USER |o--o{ TASK : assigned
    CLIENT |o--o{ PROJECT : has
    PROJECT ||--o{ PROJECT_MEMBER : contains
    PROJECT ||--o{ TASK : contains
    USER ||--o{ SESSION : opens
    ORGANIZATION ||--o{ SESSION : scopes
```

## Delete behaviour

Cascades are chosen per relation, never applied blanket.

| Relation                  | On delete | Why                                                                               |
| ------------------------- | --------- | --------------------------------------------------------------------------------- |
| Organization → Membership | `Cascade` | Memberships are meaningless without the organization.                             |
| Organization → Client     | `Cascade` | Tenant data disappears with the tenant.                                           |
| Organization → Project    | `Cascade` | Same.                                                                             |
| Organization → Task       | `Cascade` | Same.                                                                             |
| Project → ProjectMember   | `Cascade` | Assignments are meaningless without the project.                                  |
| Project → Task            | `Cascade` | A task cannot outlive its project.                                                |
| Client → Project          | `SetNull` | Deleting a client must not destroy delivered work; the project survives unlinked. |
| User → Task (assignee)    | `SetNull` | Removing a person must not delete the work; the task becomes unassigned.          |
| User → Membership         | `Cascade` | Membership is a pure link record.                                                 |
| User → ProjectMember      | `Cascade` | Also a pure link record; nothing of value is lost.                                |

The API is stricter than these rules in two places: a client with projects and a
project with tasks cannot be deleted through it. See [CLIENTS.md](./CLIENTS.md)
and [PROJECTS.md](./PROJECTS.md).

## Indexes and constraints

Only indexes that serve a real read path. Composite indexes lead with
`organizationId`, so they also cover plain tenant scoping — a separate
single-column index on `organizationId` would be redundant.

**Unique constraints**

| Model           | Constraint                | Meaning                                    |
| --------------- | ------------------------- | ------------------------------------------ |
| `Organization`  | `slug`                    | Globally unique tenant handle.             |
| `User`          | `email`                   | One account per email.                     |
| `Membership`    | `organizationId + userId` | No duplicate membership.                   |
| `Project`       | `organizationId + code`   | Project codes are unique per organization. |
| `ProjectMember` | `projectId + userId`      | No duplicate assignment.                   |

**Indexes**

| Model           | Index                             | Read path                              |
| --------------- | --------------------------------- | -------------------------------------- |
| `Membership`    | `userId`                          | Which organizations a user belongs to. |
| `Client`        | `organizationId + name`           | Client list and search by name.        |
| `Client`        | `organizationId + documentNumber` | Lookup by tax/ID document.             |
| `Project`       | `organizationId + status`         | Project list filtered by status.       |
| `Project`       | `clientId`                        | Projects of a client.                  |
| `Project`       | `organizationId + createdAt`      | Default project list ordering.         |
| `Project`       | `organizationId + dueDate`        | Sorting by due date.                   |
| `ProjectMember` | `userId`                          | Projects a user participates in.       |
| `Task`          | `projectId + status + position`   | Kanban board: column, in order.        |
| `Task`          | `organizationId + status`         | Organization-wide task views.          |
| `Task`          | `assigneeId`                      | A user's assigned tasks.               |
| `Session`       | `userId`                          | Revoke every session of a user.        |
| `Session`       | `organizationId`                  | Sessions within an organization.       |
| `Session`       | `expiresAt`                       | Future cleanup of expired rows.        |

## Conventions

- Models `PascalCase`, fields `camelCase`, enums `PascalCase` with `UPPER_CASE`
  values. Prisma names the tables after the models; there is no `@@map` layer.
- `Priority` is one shared enum for `Project` and `Task` — the scale is identical,
  so it is modelled once rather than duplicated.
- Every main entity carries `createdAt` (`@default(now())`) and `updatedAt`
  (`@updatedAt`). Timestamps are produced by the database layer, never by the
  frontend. `ProjectMember` is the exception: it is an immutable join record and
  only has `createdAt`.
- Optional fields are genuinely optional; nothing is made nullable for convenience.

## Migrations

Real migration history — `prisma db push` is not used as a substitute.

```bash
pnpm prisma:migrate     # create and apply a migration (prisma migrate dev)
pnpm prisma:status      # check whether the database matches the history
pnpm prisma:generate    # regenerate Prisma Client
pnpm prisma:studio      # browse data
```

Migrations live in `apps/api/prisma/migrations/` and are committed. The generated
client (`apps/api/src/generated/prisma/`) is **not** committed — it is regenerated
by `pnpm prisma:generate`, and both `build` and `typecheck` run it first so a fresh
clone works.

## Seed

```bash
pnpm prisma:seed
```

`apps/api/prisma/seed.ts` creates the minimum needed for development:

- Organization `NovaTec` (slug `novatec`, `ACTIVE`)
- User `dev@novatec.local` (Luis Carranza, `ACTIVE`)
- Membership linking the two with role `OWNER`

It is **idempotent** — every write is an `upsert` on a unique constraint, so
running it repeatedly never duplicates data. It stores no passwords and uses a
`.local` address rather than a real mailbox. The owner is created **without a
password**; set one with `pnpm auth:bootstrap-owner` — see
[AUTHENTICATION.md](./AUTHENTICATION.md).

## Health check

`GET /health/db` runs `SELECT 1` through Prisma and answers
`{ "status": "ok", "database": "connected" }`. On failure it returns HTTP 503 with
`{ "status": "error", "database": "disconnected" }` — never a connection string,
a driver message or a stack trace. Connection strings are also redacted from logs.

## Local development cluster

Development runs against a **user-owned PostgreSQL 18.6 cluster** living in
`C:\Users\<you>\.nexo\pgdata` on port **5434**. It uses the binaries of the
system-wide PostgreSQL 18 installation but is a separate cluster: it needs no
administrator rights, is not registered as a Windows service, and does not touch
the machine's existing PostgreSQL 17 and 18 clusters.

Because it is not a service, it does **not** start automatically after a reboot:

```powershell
# start
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "$env:USERPROFILE\.nexo\pgdata" -l "$env:USERPROFILE\.nexo\postgres.log" start

# check
& "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5434

# stop
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "$env:USERPROFILE\.nexo\pgdata" stop
```

Do not start it from a shell whose process tree may later be killed: a Ctrl+C
reaching the postmaster shuts the server down.

It holds two databases:

| Database    | Purpose                                       |
| ----------- | --------------------------------------------- |
| `nexo_dev`  | Local development data. Never reset by tests. |
| `nexo_test` | Automated tests. Safe to truncate.            |

Switching to a different PostgreSQL instance later is only a matter of changing
`DATABASE_URL`; nothing in the code depends on this cluster.

## Configuration

`DATABASE_URL` is read from the environment only, through `@nestjs/config`. It is
never committed: `apps/api/.env` is gitignored and `apps/api/.env.example` holds
placeholders.

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/nexo_dev?schema=public"
```
