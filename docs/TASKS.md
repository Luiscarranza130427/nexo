# Tasks

Units of work inside a project, shown as a filterable list and as a Kanban board.

## Model

`Task` has existed since phase 3; this phase adds indexes only (see
[DATABASE.md](./DATABASE.md)).

| Field                  | Notes                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| `projectId`            | Required. The project must belong to the caller's organization.               |
| `title`                | Required, 1–200 characters.                                                   |
| `description`          | Optional, up to 5000 characters.                                              |
| `status`               | `TODO` · `IN_PROGRESS` · `IN_REVIEW` · `DONE` · `CANCELLED`. Default `TODO`.  |
| `priority`             | `LOW` · `MEDIUM` · `HIGH` · `URGENT`. Default `MEDIUM`.                       |
| `assigneeId`           | Optional. Must be an active member **of the project**.                        |
| `position`             | Order inside its column. Assigned by the API, never accepted from the client. |
| `startDate`, `dueDate` | Optional calendar dates. `dueDate` ≥ `startDate`.                             |
| `completedAt`          | Set and cleared by the API only.                                              |
| `organizationId`       | Tenant boundary. Never accepted from, nor returned to, the client.            |

Moving a task to another project is not supported.

## Permissions

| Role      | See                                    | Create | Edit                        | Assign | Move                        | Delete |
| --------- | -------------------------------------- | ------ | --------------------------- | ------ | --------------------------- | ------ |
| `OWNER`   | every task of the organization         | ✅     | ✅                          | ✅     | ✅                          | ✅     |
| `ADMIN`   | every task of the organization         | ✅     | ✅                          | ✅     | ✅                          | ✅     |
| `MANAGER` | every task of the organization         | ✅     | ✅                          | ✅     | ✅                          | ❌     |
| `MEMBER`  | tasks of projects they are a member of | ❌     | only tasks assigned to them | ❌     | only tasks assigned to them | ❌     |

The `MEMBER` rule, in full:

- They see the tasks of projects where they are a project member, and nothing
  else. A task outside that set answers **404**, as if it did not exist.
- They may edit and move a task only while it is assigned to them. Trying on a
  visible task assigned to someone else answers **403**.
- They may never change the assignee — not even to take a task or drop one.
- They cannot create or delete tasks.

All of it is enforced in the API. The interface hides the same controls, which
is UX only.

## Tenancy

- The organization always comes from the session; `organizationId`, `position`
  and `completedAt` are not in any DTO, and `forbidNonWhitelisted` rejects them.
- Every operation first confirms the project belongs to the organization. A
  project or task of another organization answers **404**.
- The assignee must be an active member of the organization **and** of the
  project, so work cannot be handed to someone outside it.

## Endpoints

| Method   | Path                      | Roles                           | Success |
| -------- | ------------------------- | ------------------------------- | ------- |
| `GET`    | `/tasks`                  | any member (visibility applies) | 200     |
| `GET`    | `/tasks/board?projectId=` | any member (visibility applies) | 200     |
| `GET`    | `/tasks/:id`              | any member (visibility applies) | 200     |
| `POST`   | `/tasks`                  | OWNER, ADMIN, MANAGER           | 201     |
| `PATCH`  | `/tasks/:id`              | any member (MEMBER: own tasks)  | 200     |
| `PATCH`  | `/tasks/:id/move`         | any member (MEMBER: own tasks)  | 200     |
| `DELETE` | `/tasks/:id`              | OWNER, ADMIN                    | 204     |

### `GET /tasks`

| Param              | Values                                                                                  | Default     |
| ------------------ | --------------------------------------------------------------------------------------- | ----------- |
| `page`             | ≥ 1                                                                                     | `1`         |
| `limit`            | 1–100                                                                                   | `20`        |
| `search`           | matches `title` and `description`, case-insensitive                                     | —           |
| `projectId`        | UUID                                                                                    | —           |
| `status`           | a `TaskStatus`                                                                          | —           |
| `priority`         | a `Priority`                                                                            | —           |
| `assigneeId`       | UUID                                                                                    | —           |
| `dueFrom`, `dueTo` | `YYYY-MM-DD`, inclusive                                                                 | —           |
| `sortBy`           | `position` · `title` · `priority` · `createdAt` · `updatedAt` · `startDate` · `dueDate` | `createdAt` |
| `sortOrder`        | `asc` · `desc`                                                                          | `desc`      |

Rows carry the project reference (`id`, `code`, `name`) and the assignee
(`userId`, names, `avatarUrl`); the detail adds `description`.

### `GET /tasks/board`

The list is paginated and capped at 100 rows, which is right for a table and
wrong for a board: a board needs every open task of one project, grouped by
column, in a single response. So the board has its own read endpoint — built on
the same filters and visibility rules, not a second copy of them.

- Columns: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. `CANCELLED` is left off
  the board; cancelled tasks remain in the list.
- At most **200 tasks per column**, in position order, each column with its real
  `total`. A column beyond that needs virtualization, which is not built.
- Accepts `search`, `priority` and `assigneeId`.
- A `MEMBER` who is not a member of the project gets **403**.
- Response: `{ limitPerColumn, columns: [{ status, total, tasks }] }`, where
  `total` counts every matching task even when `tasks` is capped. Four capped
  queries and one grouped count run in parallel; descriptions are never loaded.

## Position strategy

Positions are integers spaced **1000** apart (`1000`, `2000`, `3000`…), scoped to
a project and a status.

- **Create** appends to the end of its column: highest position + 1000.
- **Move** does not accept a raw position. The client says where the task lands
  relative to its new neighbours:

  ```json
  { "status": "IN_PROGRESS", "afterTaskId": "…", "beforeTaskId": "…" }
  ```

  `afterTaskId` is the task that will sit directly above; `beforeTaskId` the one
  directly below. Either can be omitted: only `afterTaskId` means "below this
  one", only `beforeTaskId` means "above this one", neither means "end of the
  column". Both neighbours must be in the target column, belong to the same
  project, and be in that order, or the move is `INVALID_TASK_POSITION`.

- The new position is the midpoint of its neighbours. When two neighbours are
  adjacent integers there is no room left, and that column is **renormalized**
  to 1000, 2000, 3000… in the same transaction. With a gap of 1000 that takes
  about ten consecutive insertions into the same spot, so it is rare.
- Changing `status` through `PATCH /tasks/:id` also appends to the end of the new
  column.

Creates, moves and status changes run in a transaction that first locks the
project row (`SELECT … FOR UPDATE`). Two people reordering the same project
queue behind each other instead of computing the same midpoint; different
projects never wait on each other. This is the only raw SQL in the module — a
row lock is not expressible through Prisma's query API.

## `completedAt`

Maintained by the API on create, update and move:

- entering `DONE` sets it to now;
- leaving `DONE` clears it;
- staying in `DONE` keeps the original time.

## Errors

| Code                               | HTTP | When                                                              |
| ---------------------------------- | ---- | ----------------------------------------------------------------- |
| `TASK_NOT_FOUND`                   | 404  | Unknown id, another organization, or outside a MEMBER's projects. |
| `TASK_PROJECT_NOT_FOUND`           | 404  | The project does not exist in this organization.                  |
| `TASK_ASSIGNEE_NOT_FOUND`          | 400  | The assignee is not an active member of the organization.         |
| `TASK_ASSIGNEE_NOT_PROJECT_MEMBER` | 400  | The assignee belongs to the organization but not the project.     |
| `INVALID_TASK_DATES`               | 400  | `dueDate` before `startDate`, or `dueTo` before `dueFrom`.        |
| `INVALID_TASK_POSITION`            | 400  | A move neighbour is missing, elsewhere, or out of order.          |
| `TASK_MOVE_FAILED`                 | 409  | The project disappeared while the move was running.               |
| `FORBIDDEN`                        | 403  | Role not enough, or a MEMBER acting on someone else's task.       |

## Frontend

| Route                  | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `/tasks`               | Every visible task: search, filters, sorting, pagination        |
| `/projects/[id]`       | Task summary, "Tablero", "Abrir tablero", "Crear primera tarea" |
| `/projects/[id]/board` | Kanban board with drag and drop                                 |

Lives in `src/features/tasks/`.

- **Create and edit** share one dialog. From a project page or a board the
  project is fixed; from a board column the status starts as that column; from a
  `/tasks` list filtered by project, that project comes preselected. A `MEMBER`
  editing their own task sees the assignee locked.
- **Detail** opens in a side sheet from a row or a card, with a quick status
  change for whoever may edit the task.
- **Assignee picker** lists the project's members only.
- **Filters** live in the URL on both surfaces. The list filters by project,
  status, priority, assignee (with "Asignadas a mí") and a due-date range; the
  board by search, priority and assignee.
- **Drag and drop** uses `@dnd-kit/core` and `@dnd-kit/sortable`. The whole card
  is the handle: a mouse drag starts after 5 px, so a click still opens the card;
  on touch it takes a 200 ms press, so a swipe still scrolls the board.
- **Keyboard**: Space lifts a card, the arrows move it within and across columns,
  Space or Enter drops it and Escape cancels. Enter on a card that is not lifted
  opens its detail. Every step is announced in Spanish.
- **Without dragging**: each card's menu has "Mover a", which sends the task to
  the end of another column through the same move endpoint.
- **Optimistic moves**: on drop the board cache is rewritten at once, rolled back
  with a toast if the API refuses, and refetched either way so it never drifts
  from the server. The dropped arrangement stays on screen until the cache
  changes, so a card never flashes back to where it came from. The rearranging
  itself is pure code in `board-logic.ts`, unit tested without a browser.
- A `MEMBER` can drag only the cards assigned to them; the other cards still open,
  and still accept drops next to them.
- On small screens the board scrolls horizontally, one readable column at a time,
  rather than squeezing four columns into the width of a phone.
- Cancelled tasks stay off the board, which links to the list filtered by
  `CANCELLED`.

## Tests

- **API end-to-end** (`apps/api/test/tasks.e2e-spec.ts`, against `nexo_test`):
  listing, filters, search and pagination; create permissions, validation,
  defaults and positions, including concurrent creates; edits, reassignment
  rules and `completedAt`; moves last → first, first → middle and
  `TODO → IN_PROGRESS → IN_REVIEW → DONE → TODO`; neighbour validation;
  renormalization after repeated insertions; concurrent moves into one column;
  `MEMBER` ownership; delete by role; the board; tenant isolation.
- **API unit**: `task-rules.spec.ts` (insertion index, midpoints, renormalized
  positions, `completedAt`) and `tasks.contract.spec.ts` (shared enum matches
  the database).
- **Web unit**: board rearrangements, the form schema, labels and due dates,
  error wording, query serialization and keys, and the task permissions.
