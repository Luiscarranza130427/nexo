# Requirements

Records what Nexo is expected to do, so scope stays explicit as the product is
built. Items are marked as they land; everything unmarked is still pending.

## MVP

The smallest version of Nexo that a team could actually run its operations on.

### Accounts and access

- ✅ Email and password authentication with refresh tokens.
- ✅ Role-based access control: `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`.
- ✅ A user belongs to one or more organizations and can switch between them.

### Core records

- **Clients** — ✅ implemented. Create, edit and delete; person or company,
  identification document, contact details and address; `ACTIVE` / `INACTIVE` /
  `PROSPECT` status used to retire a client rather than deleting them. Listing
  supports search, filters, sorting and server-side pagination, and every
  operation is scoped to the organization. See [CLIENTS.md](./CLIENTS.md).
- **Projects** — ✅ implemented. Optional client, status, priority, start and due
  dates, an API-generated code unique per organization (`NEX-001`), and assigned
  team members. Search, filters, sorting and server-side pagination, all scoped to
  the organization. See [PROJECTS.md](./PROJECTS.md).
- **Tasks** — belong to a project; have an assignee, a status and a due date.
- **Team** — invite users, assign roles, deactivate users.

### Interface

- Authenticated application layout with navigation.
- List and detail views for clients, projects and tasks.
- Forms with client-side and server-side validation.
- Usable on desktop; readable on mobile.

### Platform

- All data persisted in PostgreSQL.
- Every write is authorized against the acting user's role.
- No secrets in the repository.

## Future

Valuable, but explicitly out of the MVP.

- **Documents** — upload, version and attach files to clients and projects.
- **Finances** — budgets, invoices, payment status and basic reporting.
- **Calendar** — deadlines and milestones in a calendar view.
- **Notifications** — in-app and email notifications for relevant changes.
- **Activity log** — auditable history of changes per record.
- **Dashboards** — aggregated metrics and charts.
- **Advanced RBAC** — custom roles and per-resource permissions.
- **Real-time updates** — live collaboration via WebSockets.
- **Integrations** — calendar, email and accounting providers.
- **Multi-organization** — a single user working across organizations.
