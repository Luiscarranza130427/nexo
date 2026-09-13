# Security

Practices this codebase commits to. See [AUTHENTICATION.md](./AUTHENTICATION.md)
for how the auth flow itself works.

## Password hashing

- **Argon2id**, with the OWASP Password Storage baseline: 19 MiB memory,
  2 iterations, 1 lane. Not bcrypt: Argon2id resists GPU and side-channel
  attacks far better at comparable cost.
- Salts are random and embedded by the algorithm, so the same password hashes
  differently every time. Tests never assert an exact hash — they verify
  behaviour through `argon2.verify`.
- Plain passwords are never stored, logged or returned. `passwordHash` never
  leaves the backend: it is absent from every type in `@nexo/types`, and
  end-to-end tests assert that no response body contains it.
- A malformed stored hash is treated as a failed verification, never as a crash.

## Token storage

| Token   | Lives in                             | Why                                               |
| ------- | ------------------------------------ | ------------------------------------------------- |
| Access  | A module variable in the browser tab | Short-lived, never persisted anywhere.            |
| Refresh | HttpOnly cookie                      | Unreadable by JavaScript, so XSS cannot steal it. |

The frontend keeps the access token in **memory only** — never localStorage,
sessionStorage or IndexedDB, and it never reads `document.cookie` for the
refresh token. Losing the access token on reload is intended: the HttpOnly
cookie restores the session through `/auth/refresh`.

Refresh on the client is **single-flight**. Two concurrent refreshes would both
present the same cookie, and the API would correctly read the second as reuse
and revoke the session, so every caller awaits one shared request.

**Refresh tokens are never stored in `localStorage`** — anything JavaScript can
read, an injected script can exfiltrate.

The server stores only a **SHA-256 fingerprint** of the current refresh token, so
a database leak does not hand over usable tokens. SHA-256 rather than Argon2 is
deliberate: the token is already high-entropy, there is nothing to brute-force,
and the comparison runs on every refresh. Comparison is constant-time.

Access and refresh tokens are signed with **different secrets**. A leaked access
secret must not allow minting refresh tokens.

## Invitation tokens

- **Generation**: `crypto.randomBytes(32)`, base64url — 256 bits of entropy.
- **Storage**: only a SHA-256 fingerprint, in a unique column, following the
  refresh-token principle. The token is returned once, inside the link in the
  creation response, and cannot be recovered afterwards.
- **Expiration**: `INVITATION_TTL_DAYS`, default 7. A pending invitation past its
  expiry is treated as expired by every endpoint, whatever the stored status says.
- **Single use**: acceptance locks the invitation row and marks it accepted in
  the same transaction, so two simultaneous acceptances cannot both succeed.
- **Existing accounts are protected**: accepting for an address that already has
  an account requires that account's password. A link never sets a password or
  changes a profile, so holding one is not enough to take over an account.
- **Limited disclosure**: the public preview returns the organization name, the
  invited email and role, the expiry and whether an account exists — never ids,
  the inviter or the fingerprint. Malformed tokens are rejected before any
  lookup, and both public endpoints are rate limited.
- **No leakage through the page**: `/invite/[token]` sends no referrer and asks
  not to be indexed.
- **Tenant isolation**: invitations are listed, created and revoked only within
  the session's organization; another organization's invitation answers 404.

## Cookie security

```
nexo_refresh=<token>; HttpOnly; Path=/auth; SameSite=Lax [; Secure]
```

- `HttpOnly` — always.
- `Secure` — driven by `COOKIE_SECURE`; must be `true` in production.
- `SameSite` — driven by `COOKIE_SAMESITE`, because the right value depends on
  the real topology: `Lax` when frontend and API share a site (including
  localhost on two ports), `None` when they are genuinely cross-site. Browsers
  only accept `None` together with `Secure`. There is no hardcoded production
  value, precisely so an insecure one cannot be baked in by accident.
- `Path=/auth` — the refresh token is not attached to unrelated API requests.

## Secret management

- No secrets in the repository. `apps/api/.env` is gitignored;
  `apps/api/.env.example` holds placeholders only.
- Secrets are read through `@nestjs/config`. `getOrThrow` is used for the JWT
  secrets, so a missing secret fails loudly at startup rather than silently
  signing with `undefined`.
- Generate real secrets with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- The bootstrap script reads the initial password from the environment, never
  from a file in the repository, and prints neither the password nor the hash.

## Safe logging

- **Never log**: passwords, password hashes, access tokens, refresh tokens,
  token fingerprints, `DATABASE_URL`, or any JWT secret.
- Database errors pass through a redactor that strips any `postgresql://…`
  connection string before the message reaches the logs.
- Reuse detection logs the **session id only** — enough to investigate, useless
  to an attacker.
- Failed logins are not logged with the attempted email, to avoid building a
  list of probed accounts in the log files.

## Error handling

- One generic `INVALID_CREDENTIALS` covers unknown email, wrong password, unset
  password and inactive account.
- Failures never expose stack traces, SQL, Prisma internals, driver messages or
  connection strings. `/health/db` answers `503` with a fixed body and nothing else.
- Errors carry a stable `code` so clients branch on that rather than on message text.

## Rate limiting

`@nestjs/throttler`, applied globally: 120 requests/minute baseline,
5/minute on `/auth/login`, 20/minute on `/auth/refresh`, 30/minute on
`GET /invitations/:token` and 10/minute on `POST /invitations/accept`, which
verifies passwords. Login is the endpoint
credential stuffing targets, so it gets the tightest budget; ordinary endpoints
are not crippled.

`THROTTLE_DISABLED` exists solely for the end-to-end suite and must never be
`true` in a real environment.

## CORS

```ts
{ origin: FRONTEND_URL, credentials: true }
```

`credentials: true` means the origin **must** be explicit. `origin: "*"` with
credentials is rejected by browsers anyway, and accepting any origin would hand
the refresh cookie to whoever asked. An origin that is not `FRONTEND_URL` simply
never receives a matching `Access-Control-Allow-Origin`, so the browser blocks it.

## Security headers

`helmet()` is applied at bootstrap: HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options`, `Referrer-Policy: no-referrer`, Cross-Origin-Opener and
Resource policies, and removal of `X-Powered-By`.

## Input validation

A global `ValidationPipe` with:

- `whitelist: true` — properties without a decorator are stripped, so a client
  cannot smuggle extra fields into a DTO;
- `forbidNonWhitelisted: true` — and the request is rejected when it tries;
- `transform: true` — payloads become real DTO instances.

Authentication runs **before** validation, so an unauthenticated caller learns
nothing about a DTO's shape.

## Authorization

- **Every authorization decision is made in the backend.** Nothing is trusted
  from the client.
- **Roles are never taken from the token.** `RolesGuard` re-reads user,
  organization and membership from PostgreSQL on each check, so a demotion or
  removal applies on the next request instead of at token expiry.
- Routes are protected by default; `@Public()` is the only way to open one, which
  makes every public endpoint an explicit, reviewable decision.
- The session row is re-validated on every request, so logout is immediate rather
  than eventual.
- **Frontend route protection is UX, never a security boundary.** The redirects
  in `apps/web` and the `can()` helper that hides menu options exist so people
  are not shown things they cannot use. They stop nobody: anyone can edit client
  state. The NestJS API is the only authority, and it re-reads user, organization
  and membership from PostgreSQL on every request.
- The interface never receives anything it must not see: `passwordHash`,
  `refreshTokenHash` and session internals are absent from every type in
  `@nexo/types`, and end-to-end tests assert that no response body contains them.

## Multi-tenant boundary

`Organization` is the tenant boundary. Every business entity carries an
`organizationId`.

- The active organization comes from the **session row**, never from a header,
  query parameter or body field. A client cannot name the tenant it wants to act on.
- `switch-organization` verifies membership against the database before moving
  the session.
- Access tokens naming a stale organization are rejected, so a switch cannot be
  undone by replaying an older token.
- Removing a member revokes their sessions **in that organization** at once;
  their sessions in other organizations are untouched.
- An organization never loses its last active owner: role changes and removals
  check it under a lock on the organization row.

Row Level Security is **not** implemented. Today the boundary is enforced in the
application layer; queries in future phases must scope by `organizationId`
explicitly. That is a deliberate limitation to revisit when the platform actually
serves external tenants.

## Known limitations

Honest list of what is _not_ protected yet, all scheduled for later phases:

- No CSRF token. The refresh cookie is `SameSite=Lax` and scoped to `/auth`, and
  the API is otherwise `Authorization`-header based, but a cross-site deployment
  using `SameSite=None` would need CSRF protection added.
- No two-factor authentication, passkeys or OAuth.
- No password reset flow, and no email delivery: invitation links are copied and
  shared by hand.
- No account lockout after repeated failures beyond IP rate limiting.
- No audit log of security events.
- No automated cleanup of expired sessions.
