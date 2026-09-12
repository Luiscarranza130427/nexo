# Clients

The first business module: the companies and people an organization works with.

## Model

`Client` (see [DATABASE.md](./DATABASE.md) for the full schema).

| Field                       | Notes                                          |
| --------------------------- | ---------------------------------------------- |
| `id`                        | UUID.                                          |
| `organizationId`            | Tenant boundary. **Never exposed by the API.** |
| `type`                      | `PERSON` \| `COMPANY`.                         |
| `name`                      | Required, 1–200 characters.                    |
| `documentType`              | Optional free text (`DNI`, `RUC`, `CE`, …).    |
| `documentNumber`            | Optional, unique per organization.             |
| `email`, `phone`, `address` | Optional.                                      |
| `status`                    | `ACTIVE` \| `INACTIVE` \| `PROSPECT`.          |
| `createdAt`, `updatedAt`    | ISO strings in every response.                 |

`documentType` is deliberately **not** a database enum. Nexo starts with NovaTec
in Peru, but the first foreign client would otherwise need a migration. The form
offers the common local codes; the column accepts anything.

A new client defaults to **`PROSPECT`**: a client is a prospect until there is
real work, and starting them `ACTIVE` would overstate the relationship.

## Permissions

| Role      | List | View | Create | Edit | Delete |
| --------- | ---- | ---- | ------ | ---- | ------ |
| `OWNER`   | ✅   | ✅   | ✅     | ✅   | ✅     |
| `ADMIN`   | ✅   | ✅   | ✅     | ✅   | ✅     |
| `MANAGER` | ✅   | ✅   | ✅     | ✅   | ❌     |
| `MEMBER`  | ✅   | ✅   | ❌     | ❌   | ❌     |

Enforced by `@Roles(...)` on the controller, which `RolesGuard` re-reads from the
database on every request. The interface hides what a role cannot use, but that
is UX only — see [SECURITY.md](./SECURITY.md).

## Tenancy

Every operation is scoped to the organization on the **validated session**.
`organizationId` is never read from the request: it is not in any DTO, and the
global `ValidationPipe` runs with `forbidNonWhitelisted`, so sending it is a 400.

A client belonging to another organization answers **404, not 403** — a 403 would
confirm the id exists, which leaks across tenants.

## Endpoints

| Method   | Path           | Roles                 | Success |
| -------- | -------------- | --------------------- | ------- |
| `GET`    | `/clients`     | any member            | 200     |
| `GET`    | `/clients/:id` | any member            | 200     |
| `POST`   | `/clients`     | OWNER, ADMIN, MANAGER | 201     |
| `PATCH`  | `/clients/:id` | OWNER, ADMIN, MANAGER | 200     |
| `DELETE` | `/clients/:id` | OWNER, ADMIN          | 204     |

### Filters, sorting and pagination

`GET /clients` accepts:

| Param       | Values                               | Default     |
| ----------- | ------------------------------------ | ----------- |
| `page`      | ≥ 1                                  | `1`         |
| `limit`     | 1–100                                | `10`        |
| `search`    | free text, ≤ 100 chars               | —           |
| `status`    | `ACTIVE` \| `INACTIVE` \| `PROSPECT` | —           |
| `type`      | `PERSON` \| `COMPANY`                | —           |
| `sortBy`    | `name` \| `createdAt` \| `updatedAt` | `createdAt` |
| `sortOrder` | `asc` \| `desc`                      | `desc`      |

`search` matches `name`, `email`, `phone` and `documentNumber`, case-insensitively,
through Prisma's native `contains` — no raw SQL. `limit` is capped at 100 so the
endpoint cannot be turned into a full export.

```json
{
  "data": [{ "id": "…", "type": "COMPANY", "name": "Acme SAC", "status": "ACTIVE" }],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

Listing runs two queries in parallel (the page and the count) and never includes
projects: a list does not need them.

## Errors

| Code                             | HTTP | When                                                    |
| -------------------------------- | ---- | ------------------------------------------------------- |
| `CLIENT_NOT_FOUND`               | 404  | Unknown id, or a client of another organization.        |
| `CLIENT_DOCUMENT_ALREADY_EXISTS` | 409  | Document number already used in this organization.      |
| `CLIENT_HAS_PROJECTS`            | 409  | Deletion refused because projects reference the client. |
| `FORBIDDEN`                      | 403  | Authenticated, but the role is not enough.              |

Prisma codes, SQL and stack traces never reach the client.

## Duplicate document numbers

Unique per organization, not globally: two organizations may legitimately deal
with the same company.

`documentNumber` is nullable, and PostgreSQL treats each `NULL` as distinct, so
any number of clients without a document coexist without colliding.

The service checks for a duplicate before writing — which turns a raw `P2002`
into a meaningful error — and also catches `P2002` around the write, which covers
the race between the check and the insert.

## Deletion

A client with projects **cannot be deleted** (`409 CLIENT_HAS_PROJECTS`). The
`Client → Project` relation is `SetNull`, so deleting would silently orphan
delivered work. Retiring a client is what `status: INACTIVE` is for.

There is no soft delete and no `deletedAt`: `status` already covers the need, and
adding a column without a demonstrated reason would complicate every query.

## Normalization

Applied before storing: `name` trimmed (never case-folded — a name belongs to its
owner), `email` trimmed and lowercased, `documentType` trimmed and uppercased
(it is a code), `documentNumber` / `phone` / `address` trimmed. A field that
trims to empty is stored as `NULL`, so blanking a field in the form clears it.

## Indexes

Added in `improve_client_constraints`:

| Index                                        | Purpose                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@@unique([organizationId, documentNumber])` | Uniqueness per tenant (replaces the former plain index — a unique constraint is backed by one). |
| `@@index([organizationId, createdAt])`       | Default list ordering.                                                                          |
| `@@index([organizationId, status])`          | The selective filter.                                                                           |
| `@@index([organizationId, name])`            | Existing: name search and sorting.                                                              |

`type` is deliberately **not** indexed: with two possible values it would barely
narrow anything the `organizationId` prefix has not already narrowed.

## Frontend

| Route                | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `/clients`           | List with search, filters, sorting, paging |
| `/clients/new`       | Create                                     |
| `/clients/[id]`      | Detail                                     |
| `/clients/[id]/edit` | Edit                                       |

Lives in `src/features/clients/` (`api/`, `components/`, `hooks/`, `schemas/`).

- **URL is the state.** Filters, page and sorting live in search params, so a
  filtered view survives a reload, works with the back button and can be shared.
  Changing a filter or the sort resets the page; changing the page does not.
- **Search is debounced** ~350ms, so typing does not fire a request per keystroke.
- **Pagination is real**: the server returns one page, never the whole table.
- **One form** (`ClientForm`) serves create and edit; only defaults and the
  submit label differ.
- **Two empty states**, because an empty database and a fruitless search are not
  the same thing.
- Desktop renders a real `<table>`; below `md` the same data becomes cards, so
  nothing is squeezed sideways at 320px.
- Creating or editing redirects to the detail view.
- Deleting opens an `AlertDialog` that names the client. On
  `CLIENT_HAS_PROJECTS` it stays open and explains why, rather than closing as
  though it had worked.

Query keys are hierarchical (`clientKeys.lists()`, `clientKeys.detail(id)`), so a
create invalidates only the lists and an edit refreshes the detail plus the
lists. Nothing calls a blanket `invalidateQueries()`.
