# Roadmap

Phases are built in order. Nothing from a later phase is implemented early.

| Phase | Scope                            | Status         |
| ----- | -------------------------------- | -------------- |
| 1     | Environment and Git              | ✅ Done        |
| 2     | Monorepo and base applications   | ✅ Done        |
| 3     | Database and Prisma              | ✅ Done        |
| 4     | Authentication and RBAC          | ⬜ Not started |
| 5     | Design system and layout         | ⬜ Not started |
| 6     | Clients                          | ⬜ Not started |
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

**4 — Authentication and RBAC.** JWT with refresh tokens, session handling, roles
and permission checks on every write.

**5 — Design system and layout.** shadcn/ui, the application shell, navigation,
typography and the visual language. Includes replacing the placeholder favicon.

**6 — Clients.** First real domain area: CRUD, list and detail views, validation.

**7 — Projects.** Projects tied to clients, with status and ownership.

**8 — Tasks.** Tasks inside projects, with assignees, statuses and due dates.

**9 — Team.** Users, invitations, role assignment and deactivation.

**10 — Documents.** File upload, storage and attachment to records.

**11 — Finances.** Budgets, invoices and payment tracking.

**12 — Calendar and notifications.** Calendar views, in-app and email notifications.

**13 — Testing, security and production.** Playwright end-to-end tests, security
hardening, CI/CD in `.github/`, and deployment.
