# Authentication

Nexo is an internal platform: **there is no public registration**. People join
through an invitation from an owner or an administrator (see
[TEAM.md](./TEAM.md)), and the very first owner is bootstrapped with the script
described at the end of this document.

## Endpoints

| Method | Path                        | Auth   | Purpose                            |
| ------ | --------------------------- | ------ | ---------------------------------- |
| `POST` | `/auth/login`               | public | Exchange credentials for a session |
| `POST` | `/auth/refresh`             | cookie | Rotate the refresh token           |
| `GET`  | `/auth/me`                  | access | Who am I, where, and as what       |
| `POST` | `/auth/logout`              | access | Revoke the current session         |
| `POST` | `/auth/logout-all`          | access | Revoke every session of the user   |
| `POST` | `/auth/switch-organization` | access | Move the session to another org    |

Every other route in the API is authenticated by default.

## Login

```http
POST /auth/login
{ "email": "...", "password": "...", "organizationId": "..." }   // organizationId optional
```

1. The email is normalized (trimmed, lowercased) and the user looked up.
2. The password is verified with Argon2id.
3. The user must be `ACTIVE`.
4. Only then are the user's organizations read.
5. The organization context is resolved:
   - **one membership, no `organizationId`** → that organization is used;
   - **several memberships, no `organizationId`** → `409 ORGANIZATION_REQUIRED`,
     with the list of organizations (`id`, `name`, `slug` only) so the client can
     ask. One is never chosen silently;
   - **`organizationId` given** → membership is verified; otherwise
     `403 INVALID_ORGANIZATION`.
6. A `Session` row is created and both tokens are issued.

The response body carries the user, organization, role and the access token. The
refresh token is **not** in the body — it is set as an HttpOnly cookie.

### No user enumeration

"Unknown email", "wrong password", "no password set" and "inactive account" all
answer `401` with exactly the same body:

```json
{ "code": "INVALID_CREDENTIALS", "message": "Invalid credentials." }
```

Timing is levelled too: when the email is unknown, the service still performs an
Argon2 verification against a throwaway hash, so a missing account does not
answer measurably faster than a wrong password.

## Access token

A JWT, short-lived (`JWT_ACCESS_TTL`, default `15m`), sent as
`Authorization: Bearer <token>`.

Claims are deliberately minimal — `sub`, `sessionId`, `organizationId`, plus
`iat`/`exp`. No email, no name, **no role**. A token bears identity; it is not a
cache of profile or permission data. Roles are always re-read from the database.

Validation does more than check the signature: the session row is loaded on every
request and must exist, not be revoked, not be expired, belong to the same user,
and be in the same organization the token names. That costs one primary-key
lookup per request and buys revocation that actually takes effect immediately.

## Refresh token

A JWT signed with a **different secret** (`JWT_REFRESH_SECRET`), long-lived
(`JWT_REFRESH_TTL`, default `7d`), delivered only as a cookie:

| Attribute  | Development    | Production                     |
| ---------- | -------------- | ------------------------------ |
| Name       | `nexo_refresh` | `nexo_refresh`                 |
| `HttpOnly` | yes            | yes                            |
| `Secure`   | no             | yes (`COOKIE_SECURE=true`)     |
| `SameSite` | `Lax`          | `Lax`, or `None` if cross-site |
| `Path`     | `/auth`        | `/auth`                        |

`HttpOnly` means JavaScript cannot read it, which is exactly why the refresh
token is never put in `localStorage`. `Path=/auth` keeps it off every other
request to the API.

Each refresh token carries a unique `jti`. Without it, two tokens minted for the
same session inside one second would be byte-identical (`iat`/`exp` only have
second resolution) and rotation would silently be a no-op.

## Sessions and rotation

A `Session` row is the server-side half of a login. It stores a **SHA-256
fingerprint** of the current refresh token, never the token itself. SHA-256 is
right here rather than Argon2: the token is already high-entropy, so there is
nothing to brute-force, and this runs on every refresh.

`POST /auth/refresh`:

1. Read the cookie; verify the signature with the refresh secret.
2. Load the session. It must exist, not be revoked (`SESSION_REVOKED`) and not be
   expired (`SESSION_EXPIRED`).
3. Compare the presented token against the stored fingerprint, in constant time.
4. Re-check the membership: a user deactivated or removed mid-session cannot renew.
5. Issue a new refresh token, overwrite the fingerprint and extend the window.
6. Issue a new access token and set the new cookie.

The previous refresh token stops working the instant a new one is issued.

### Reuse detection

If a token has a valid signature but does **not** match the stored fingerprint,
it is a previously rotated token being replayed — either stolen or a
misbehaving client. The session is revoked immediately and the caller gets a
generic `SESSION_REVOKED`. Only the session id is logged; tokens never are.

## Logout

`POST /auth/logout` revokes the session row and clears the cookie. It is not a
cookie deletion: the access token stops working at once, before it expires.

`POST /auth/logout-all` revokes every active session of the user and returns how
many were revoked.

## Organization context

`Organization` is the tenant boundary (see [DATABASE.md](./DATABASE.md)). The
active organization lives on the **session row**, never in a client-supplied
header or body field.

`POST /auth/switch-organization` verifies the membership against the database,
moves the session, rotates the refresh token and issues a new access token.
Access tokens minted for the previous organization stop working immediately,
because the strategy requires the token's organization to match the session's.

## RBAC

Roles come from `Membership`: `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`.

```ts
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@Post('something')
doSomething() {}
```

`RolesGuard` re-reads user, organization and role from the database on every
check, so changing a role or removing a member takes effect on the next request.

**Roles are matched exactly — there is no implicit hierarchy.** `@Roles(ADMIN)`
does _not_ admit an OWNER. List every role that should pass. This is explicit on
purpose; if a hierarchy is wanted later, it is a small change in one guard.

The team module is the one place with an explicit authority rule between roles —
who may change or remove whom. It lives in that module's service, not in the
guard. See [TEAM.md](./TEAM.md).

| Role      | Intent                                                |
| --------- | ----------------------------------------------------- |
| `OWNER`   | Full control of the organization.                     |
| `ADMIN`   | Administration: members, settings, all business data. |
| `MANAGER` | Operational management of projects and tasks.         |
| `MEMBER`  | Ordinary use.                                         |

No finer-grained permissions exist yet, deliberately.

## Guards and decorators

| Symbol                   | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `JwtAuthGuard`           | Global. Every route authenticated unless `@Public()`. |
| `RolesGuard`             | Global. Enforces `@Roles(...)` against the database.  |
| `@Public()`              | Opts a route out of authentication.                   |
| `@Roles(...)`            | Restricts a route to given roles.                     |
| `@CurrentUser()`         | Typed `{ userId, sessionId, organizationId }`.        |
| `@CurrentOrganization()` | The active organization id, from the session.         |

Public routes: `GET /`, `GET /health`, `GET /health/db`, `POST /auth/login`,
`POST /auth/refresh`, `GET /invitations/:token` and `POST /invitations/accept`.
Everything else is protected — forgetting to guard a new
endpoint locks it rather than exposing it.

## Error codes

| Code                    | Status | Meaning                                    |
| ----------------------- | ------ | ------------------------------------------ |
| `INVALID_CREDENTIALS`   | 401    | Bad email, password, or inactive account.  |
| `ORGANIZATION_REQUIRED` | 409    | Several memberships; the client must pick. |
| `INVALID_ORGANIZATION`  | 403    | No membership in that organization.        |
| `SESSION_EXPIRED`       | 401    | The session window has passed.             |
| `SESSION_REVOKED`       | 401    | Logged out, or reuse was detected.         |
| `UNAUTHORIZED`          | 401    | Missing or unusable token.                 |
| `FORBIDDEN`             | 403    | Authenticated, but the role is not enough. |

## Rate limiting

| Endpoint        | Limit          |
| --------------- | -------------- |
| `/auth/login`   | 5 per minute   |
| `/auth/refresh` | 20 per minute  |
| everything else | 120 per minute |

`THROTTLE_DISABLED=true` turns throttling off; it exists for the end-to-end suite
and must never be set in a real environment.

## Bootstrapping the first owner

The seed creates the owner **without a password** on purpose — no password is
ever committed to the repository.

```bash
# 1. In apps/api/.env (gitignored):
#    BOOTSTRAP_OWNER_EMAIL=dev@novatec.local
#    BOOTSTRAP_OWNER_PASSWORD=<a passphrase of at least 12 characters>

pnpm auth:bootstrap-owner

# 2. Clear BOOTSTRAP_OWNER_PASSWORD from apps/api/.env
```

The script verifies the user exists, is `ACTIVE` and is an `OWNER` of some
organization; validates the password length; hashes with Argon2id; and stores
only the hash. It prints neither the password nor the hash.

It refuses to touch a user who is not an owner: this is a bootstrap tool, not a
password-reset tool. Password reset arrives in a later phase.

## Local development administrator

A second, development-only script creates or resets `admin@novatec.local` as an
`ADMIN` of the seeded NovaTec organization, for signing in to the panel locally.

```bash
# The variable exists for this one command only; it is never written to .env.
DEV_ADMIN_PASSWORD='<a passphrase of at least 12 characters>' pnpm auth:create-admin
```

- Refuses to run when `NODE_ENV` is `production`.
- Creates the user if missing; otherwise sets it `ACTIVE` with the new password.
  An existing user is never deleted.
- Creates the NovaTec membership or sets it to `ADMIN`, leaving any other
  organization untouched.
- Hashes with Argon2id before opening the transaction, and revokes the user's
  existing sessions, as any password reset should.
- Prints neither the password nor the hash. The password is not stored in the
  repository, the documentation or the tests.

## Password policy

Minimum 12 characters, maximum 128. No composition rules — no "one uppercase, one
symbol". Those push people towards predictable passwords and away from long
passphrases, which are both stronger and easier to remember.

## Session cleanup

Rows whose `expiresAt` has passed, or whose `revokedAt` is set, stay in the table
for now. They are harmless: both are rejected on every use. A periodic job can
delete them later — the `expiresAt` index exists for exactly that. **No scheduler
is added in this phase.**
