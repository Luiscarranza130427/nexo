# Requirements

Nothing in this document is implemented yet. It records what Nexo is expected to
do so that scope stays explicit as the product is built.

## MVP

The smallest version of Nexo that a team could actually run its operations on.

### Accounts and access

- Email and password authentication with refresh tokens.
- Role-based access control: at minimum `admin` and `member`.
- A user belongs to one organization.

### Core records

- **Clients** — create, edit, archive; name, contact details, notes.
- **Projects** — belong to a client; have a status and an owner.
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
