# Team

The people of an organization, their roles and how new people join. Lives in
`apps/api/src/team/` and `apps/web/src/features/team/`.

## Membership

There is no team model. A person in an organization is a `Membership`: the link
between a `User` and an `Organization`, carrying the role. The team list reads
memberships. The status it shows is the `User` status, which applies across
every organization the person belongs to.

Removing someone deletes their membership **only**. The account survives, along
with any other organization it belongs to.

## Permissions

| Action                      | OWNER                     | ADMIN                      | MANAGER | MEMBER                    |
| --------------------------- | ------------------------- | -------------------------- | ------- | ------------------------- |
| List members, open profiles | ✅                        | ✅                         | ✅      | ✅ (shared projects only) |
| Invite                      | as ADMIN, MANAGER, MEMBER | as MANAGER, MEMBER         | ❌      | ❌                        |
| List and revoke invitations | ✅                        | ✅                         | ❌      | ❌                        |
| Change a role               | anyone, to any role       | between MANAGER and MEMBER | ❌      | ❌                        |
| Remove from the team        | anyone                    | managers and members       | ❌      | ❌                        |

The rule behind the table is **authority over roles**. An actor may act on
members holding a role, and grant that role, only when it is under them:

- OWNER → OWNER, ADMIN, MANAGER, MEMBER;
- ADMIN → MANAGER, MEMBER;
- MANAGER and MEMBER → none.

So an ADMIN cannot change or remove an owner or another admin — themselves
included — and cannot grant ADMIN or OWNER. `RolesGuard` still matches roles
exactly; this authority rule lives in `team-rules.ts`, is applied by the
service, and is mirrored by the interface as UX only.

A role change applies on the member's next request, because roles are re-read
from the database. No session has to end.

## Ownership

- An organization may have several owners.
- Promoting someone to OWNER is an explicit role change that only an owner can
  make. It never transfers ownership: the promoter remains an owner.
- **Last owner protection.** Demoting or removing an owner answers
  `409 LAST_OWNER_REQUIRED` when no other _active_ owner would remain. Inactive
  owners do not count.
- Role changes, removals and new invitations lock the organization row
  (`SELECT … FOR UPDATE`) inside their transaction, so two owners demoting each
  other at the same moment cannot both pass the check.

## Endpoints

| Method   | Path                           | Access                         | Success |
| -------- | ------------------------------ | ------------------------------ | ------- |
| `GET`    | `/team`                        | any member                     | 200     |
| `GET`    | `/team/summary`                | any member                     | 200     |
| `GET`    | `/team/:userId`                | any member                     | 200     |
| `PATCH`  | `/team/:userId/role`           | OWNER, ADMIN, within authority | 200     |
| `DELETE` | `/team/:userId`                | OWNER, ADMIN, within authority | 204     |
| `GET`    | `/team/invitations`            | OWNER, ADMIN                   | 200     |
| `POST`   | `/team/invitations`            | OWNER, ADMIN, within authority | 201     |
| `POST`   | `/team/invitations/:id/revoke` | OWNER, ADMIN                   | 200     |
| `GET`    | `/invitations/:token`          | public, 30 requests/minute     | 200     |
| `POST`   | `/invitations/accept`          | public, 10 requests/minute     | 200     |

**`GET /team`** accepts `page`, `limit` (default 20, max 100), `search` (first
name, last name and email; every word must match), `role`, `status` (the user
status), `sortBy` (`name` · `email` · `role` · `joinedAt`, default `name`) and
`sortOrder` (default `asc`). A row carries `userId`, names, `email`, `avatarUrl`,
`status`, `role`, `joinedAt` and `projectsCount` for this organization only —
never a password hash, sessions or organization internals.

**`GET /team/summary`** is one grouped count: `total` and `byRole`.

**`GET /team/:userId`** adds the person's projects in this organization (up to
50, the count is exact) and their assigned tasks by status. A MEMBER viewing
someone else sees only the projects they share, and the tasks within them — the
same visibility rule as tasks. A person outside the organization answers 404.

## Removing a member

One transaction, after the organization lock:

1. load the actor's and the target's memberships, and check authority;
2. check the last owner;
3. delete the person's `ProjectMember` rows in this organization's projects;
4. unassign their tasks in this organization (`assigneeId = null`);
5. revoke their sessions for this organization, leaving other organizations
   untouched;
6. delete the membership.

Projects, tasks and the account itself are never deleted.

## Invitations

### Model

`Invitation` holds the organization, the normalized email, the role (ADMIN,
MANAGER or MEMBER), `tokenHash`, `status`, `expiresAt`, who invited, who
accepted, and when it was accepted or revoked. See [DATABASE.md](./DATABASE.md).

A stored `PENDING` invitation past `expiresAt` is `EXPIRED` everywhere: in the
list, in the status filter, on the public page and at acceptance. The first time
one is seen that way, the stored status is settled to `EXPIRED`.

### Token security

- Generated with `crypto.randomBytes(32)`, encoded base64url: 43 URL-safe
  characters, 256 bits of entropy.
- Only the SHA-256 fingerprint is stored, as a unique column — the same principle
  as refresh tokens. A database leak yields no usable link.
- The token is returned exactly once, inside `inviteUrl` in the creation
  response. The API cannot rebuild the link: a lost link means revoking the
  invitation and creating another.
- A value that cannot be a token is rejected before any database lookup.
- Links live `INVITATION_TTL_DAYS` days: default 7, a whole number from 1 to 90.
  A bad value stops the API at startup.

### Creating

- The email is trimmed and lowercased.
- `409 USER_ALREADY_MEMBER` when the address already belongs to the
  organization; `409 INVITATION_ALREADY_PENDING` when it already has a live
  invitation. Stale pending rows for that address are settled as `EXPIRED`
  first. The organization lock makes both checks race-free, without a partial
  unique index.
- The inviter is taken from the session.
- **No email is sent** in this phase. The interface shows the link to copy.

### Accepting

`GET /invitations/:token` returns only `valid`, `status` and `organizationName`,
plus — when the invitation is still valid — `email`, `role`, `expiresAt` and
`accountExists`. Never an id, the inviter or the fingerprint. `accountExists`
tells the page whether to ask for a sign-in or a new password; it is revealed
only to the holder of a valid link, and only about the address the link was sent
to.

`POST /invitations/accept` takes `token`, `password` and, for new people,
`firstName` and `lastName`:

- **New person.** Names are required (`INVITATION_PROFILE_REQUIRED`) and the
  password must be 12–128 characters (`INVALID_PASSWORD`). The account is created
  `ACTIVE`, with an Argon2id hash.
- **Existing account.** The password must be that account's own
  (`401 INVALID_CREDENTIALS`). The link never sets a password or changes a name:
  holding it is never enough to join as someone who already has an account.
- The invitation row is locked, its status re-checked, the membership created
  with the invited role and the invitation marked `ACCEPTED`, all in one
  transaction. A simultaneous second acceptance gets
  `409 INVITATION_ALREADY_ACCEPTED`.

The response carries the organization, email and role. The interface then signs
in with that `organizationId` — or, when already signed in as that person,
switches organization — so the new organization appears in the existing
selector. If signing in automatically fails, it sends the person to
`/login?invitation=accepted`.

### Revoking

Sets `status = REVOKED` and `revokedAt`; the row stays. Revoking twice is
harmless. An accepted invitation answers `409 INVITATION_ALREADY_ACCEPTED`; an
invitation of another organization answers 404.

## Errors

| Code                          | HTTP | When                                                          |
| ----------------------------- | ---- | ------------------------------------------------------------- |
| `TEAM_MEMBER_NOT_FOUND`       | 404  | No such person in this organization.                          |
| `LAST_OWNER_REQUIRED`         | 409  | The change would leave no active owner.                       |
| `FORBIDDEN`                   | 403  | The role, or the authority over the target, is not enough.    |
| `USER_ALREADY_MEMBER`         | 409  | The address already belongs to the organization.              |
| `INVITATION_ALREADY_PENDING`  | 409  | The address already has a live invitation.                    |
| `INVITATION_NOT_FOUND`        | 404  | Unknown or malformed token, or an id of another organization. |
| `INVITATION_EXPIRED`          | 409  | Past `expiresAt`.                                             |
| `INVITATION_REVOKED`          | 409  | Revoked.                                                      |
| `INVITATION_ALREADY_ACCEPTED` | 409  | Accepted already.                                             |
| `INVITATION_ACCOUNT_CHANGED`  | 409  | An account for the address appeared mid-acceptance.           |
| `INVITATION_PROFILE_REQUIRED` | 400  | A new person without first or last name.                      |
| `INVALID_PASSWORD`            | 400  | A new password outside 12–128 characters.                     |
| `INVALID_CREDENTIALS`         | 401  | Wrong password for an existing account.                       |

## Frontend

| Route             | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `/team`           | Summary, and the Miembros and Invitaciones tabs (the latter OWNER/ADMIN) |
| `/team/[userId]`  | Profile: role, status, joining date, projects and task counts            |
| `/invite/[token]` | Public invitation page, outside the authenticated shell                  |

- Tab, filters, sorting and page live in the URL.
- A row only offers what the actor may do to that member.
- The role dialog warns when ownership is granted or removed, and when you change
  your own role; your session refreshes afterwards so the interface follows.
- The removal dialog explains the consequences and states that the account is not
  deleted. Removing yourself signs you out.
- The invitation dialog shows the link once and drops it from memory as soon as
  the dialog has closed.
- The public page covers loading, a new account, an existing account, expired,
  revoked, already accepted and invalid links. Signed in as someone else, it asks
  to sign out first. Passwords only pass through the submit handler — never
  stored. The page sends no referrer and asks not to be indexed.

## Tests

- **API end-to-end** — `test/team.e2e-spec.ts`: tenant-scoped listing, search,
  filters, sorting and pagination; profiles and shared-project visibility; role
  changes by each role, immediate effect, ownership promotion, last-owner
  protection including inactive owners and simultaneous demotions; removal with
  project, task and session cleanup scoped to one organization; cross-tenant 404.
  `test/invitations.e2e-spec.ts`: creation by role, normalization, fingerprint
  storage, duplicates and concurrency; listing with effective status; the public
  preview; acceptance by new and existing people, account takeover attempts,
  expired, revoked, accepted and simultaneous acceptances; revocation and tenant
  isolation.
- **API unit** — `team-rules.spec.ts`, `invitation-token.spec.ts`,
  `team.contract.spec.ts`.
- **Web unit** — role authority, role and status labels, invitation and account
  schemas (including password confirmation), error wording, query serialization
  and keys.
