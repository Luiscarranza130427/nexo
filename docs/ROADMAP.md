# Roadmap

Phases are built in order. Nothing from a later phase is implemented early.

| Phase | Scope                            | Status         |
| ----- | -------------------------------- | -------------- |
| 1     | Environment and Git              | ✅ Done        |
| 2     | Monorepo and base applications   | ✅ Done        |
| 3     | Database and Prisma              | ✅ Done        |
| 4     | Authentication and RBAC          | ✅ Done        |
| 5     | Design system and layout         | ✅ Done        |
| 6     | Clients                          | ✅ Done        |
| 7     | Projects                         | ⬜ Not started |
| 8     | Tasks                            | ⬜ Not started |
| 9     | Team                             | ⬜ Not started |
| 10    | Documents                        | ⬜ Not started |
| 11    | Finances                         | ⬜ Not started |
| 12    | Calendar and notifications       | ⬜ Not started |
| 13    | Testing, security and production | ⬜ Not started |

## Phase detail

**1 — Environment and Git.** Toolchain, global Git configuration, repository and
first commit.

**2 — Monorepo and base applications.** pnpm workspaces, `apps/web` on Next.js,
`apps/api` on NestJS, shared packages, tooling, documentation and agent rules.

**3 — Database and Prisma.** PostgreSQL, Prisma schema, migrations, and the data
access layer inside `apps/api`.

**4 — Authentication and RBAC.** Argon2id passwords, JWT access tokens, rotating
refresh tokens backed by revocable sessions, organization context and switching,
role checks re-read from the database, rate limiting and API hardening. See
[AUTHENTICATION.md](./AUTHENTICATION.md) and [SECURITY.md](./SECURITY.md).

**5 — Design system and layout.** shadcn/ui on semantic design tokens, light and
dark themes, the application shell (sidebar, header, user menu), the login screen,
session bootstrap and organization switching. See [FRONTEND.md](./FRONTEND.md).

**6 — Clients.** First real domain area: CRUD with pagination, search, filters
and sorting; per-organization document uniqueness; role-aware UI. See
[CLIENTS.md](./CLIENTS.md).

**7 — Projects.** Projects tied to clients, with status and ownership.

**8 — Tasks.** Tasks inside projects, with assignees, statuses and due dates.

**9 — Team.** Users, invitations, role assignment and deactivation.

**10 — Documents.** File upload, storage and attachment to records.

**11 — Finances.** Budgets, invoices and payment tracking.

**12 — Calendar and notifications.** Calendar views, in-app and email notifications.

**13 — Testing, security and production.** Playwright end-to-end tests, security
hardening, CI/CD in `.github/`, and deployment.
