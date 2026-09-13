# Frontend

The Next.js application in `apps/web`. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for how it fits with the API, and [SECURITY.md](./SECURITY.md) for the rules it
must not break.

## Structure

```
apps/web/src/
├── app/
│   ├── (auth)/login/          Sign-in screen, its own layout
│   ├── (app)/                 Authenticated shell + every module page
│   ├── layout.tsx             Root layout, fonts, providers
│   ├── page.tsx               Routes to /dashboard or /login
│   ├── error.tsx              Error boundary
│   └── not-found.tsx          404
├── components/
│   ├── ui/                    shadcn/ui primitives (generated)
│   ├── layout/                Sidebar, header, user menu, theme toggle
│   ├── auth/                  Login form and organization picker
│   └── shared/                PageHeader, EmptyState, LoadingScreen, …
├── features/
│   ├── auth/                  Auth provider, state, permissions, schema
│   ├── clients/               Clients module: api, components, hooks, schemas
│   ├── projects/              Projects module: api, components, hooks, schemas
│   └── tasks/                 Tasks module: list, Kanban board, board logic, dialogs
├── lib/api/                   HTTP client, typed calls, error normalization
├── lib/format-date.ts         Timestamp formatting shared by modules
├── providers/                 Every client provider, composed once
├── config/                    Navigation definition
└── hooks/                     Small reusable hooks
```

## Route groups

Two groups with genuinely different chrome:

- **`(auth)`** — no shell. Its layout sends signed-in people to `/dashboard`.
- **`(app)`** — sidebar, header, content area. Its layout sends signed-out
  people to `/login`.

`/` is a router, not a page: there is no public landing in this phase.

**Those redirects are UX, not security.** The real boundary is the NestJS API,
which authenticates every request and re-reads membership from the database.
Route protection here only avoids a flash of empty chrome and a cascade of 401s.

## Providers

Composed once in `providers/app-providers.tsx`, in this order:

1. `ThemeProvider` (next-themes) — only touches the document.
2. `QueryClientProvider` (TanStack Query) — the cache.
3. `AuthProvider` — needs the cache, because switching organization invalidates it.
4. `TooltipProvider` + `Toaster`.

## Design system

**shadcn/ui** with the Radix base and the Nova preset (Lucide icons, Geist).
Components are generated into `components/ui/` and owned by this repository.

Only what is used is installed: button, input, label, textarea, select, card,
avatar, dropdown-menu, dialog, alert-dialog, sheet, table, tooltip, separator,
skeleton, badge, breadcrumb, alert and sonner.

Drag and drop on the task board uses `@dnd-kit/core` and `@dnd-kit/sortable`,
chosen because they support keyboard and touch sensors and screen-reader
announcements out of the box. See [TASKS.md](./TASKS.md).

Every colour is a semantic token in `app/globals.css` — `background`,
`foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`,
`destructive`, `success`, `warning`, `border`, `input`, `ring`, plus the
`sidebar-*` set and a `brand` pair. **Components never hardcode a colour**; a
palette change lands in one file.

Icons are Lucide at 16 / 18 / 20 / 24. Emoji are never used as iconography.

There is no Nexo logo asset: the mark is a typographic monogram in
`components/shared/nexo-mark.tsx`, easy to replace with a real one. NovaTec
appears as quiet parent-brand attribution, never competing with Nexo.

## Theme

`next-themes` with `attribute="class"`, defaulting to **system** and persisting
the choice. The toggle offers light, dark and system.

The trigger icon is picked by CSS (`dark:hidden` / `hidden dark:block`) rather
than by state, which sidesteps the usual "mounted" flag and the hydration
mismatch it exists to paper over. `<html>` carries `suppressHydrationWarning`
because next-themes writes the class before React hydrates.

## API client

`lib/api/client.ts` is the only place that calls `fetch`. It owns the base URL
(`NEXT_PUBLIC_API_URL`), `credentials: 'include'`, headers, error normalization
and token refresh.

`lib/api/errors.ts` turns every failure into an `ApiError { status, code, body }`,
so nothing in the application writes `catch (error: any)`. `errorMessage()` maps
each code to Spanish wording and **deliberately ignores the server's own message
text** — that is written for developers and must never reach the interface.

## Token strategy

| Token   | Where it lives                  | Why                                        |
| ------- | ------------------------------- | ------------------------------------------ |
| Access  | A module variable — memory only | Anything a script can read, XSS can steal. |
| Refresh | HttpOnly cookie, set by the API | Unreadable by JavaScript, revocable.       |

**Never** localStorage, sessionStorage or IndexedDB. The frontend never touches
`document.cookie` for the refresh token.

Losing the access token on reload is intended — the cookie restores the session.

### Automatic refresh

A request that returns 401 triggers one refresh and one retry. The refresh
itself never retries, so there is no path that can loop.

Refresh is **single-flight**: every caller awaits the same promise. That is a
correctness requirement, not an optimization — refresh _rotates_ the token, so
two concurrent calls would both present the same cookie, and the API would
correctly read the second as token reuse and revoke the whole session.

If the refresh fails, the client clears the token and notifies `AuthProvider`,
which resets state and clears the query cache.

## Auth bootstrap

On load:

1. `LoadingScreen` shows (branded, never a blank page).
2. `POST /auth/refresh` runs through the shared single-flight.
3. On success the access token goes into memory and the session into state.
4. On failure the state settles to signed-out. Not an error — just no session.

There is **no follow-up `/auth/me`**: `/auth/refresh` already returns the full
session alongside the token, so calling it would be a duplicate round trip on
every page load.

Strict mode runs the effect twice in development; both runs await the same
shared refresh, so the API sees one request.

## State

- **Session** lives in `AuthProvider` (React state). It is identity, not
  server data to revalidate on a schedule.
- **Business data** will live in TanStack Query, configured with a 60s
  `staleTime`, no refetch on window focus, and no retry on 401/403.
- Switching organization invalidates every query: the cache belonged to the
  previous tenant.

No Redux, no Zustand — Context plus TanStack Query covers what exists.

## Permissions in the UI

`features/auth/permissions.ts` maps roles to capabilities and `can()` answers
whether to show something. Navigation items can declare a `capability`.

**This is UX, not security.** Hiding a button protects nothing; the API enforces
`@Roles(...)` against the database on every request. Roles are shown humanized
(`Propietario`, not `OWNER`).

## Responsive

Verified with no horizontal overflow at 320, 375, 768, 1024 and 1440.

- Sidebar: full at `lg` and above, collapsible to icons with tooltips; below
  `lg` the same navigation is a drawer opened from the header.
- Login: split layout from `lg`, single column below.
- The collapsed preference is per-device, kept in localStorage via
  `useSyncExternalStore`.

## Accessibility

Real `<label for>` on every field, `autocomplete` set, `aria-invalid` and
`aria-describedby` on errors, `role="alert"` on messages, `aria-current` on the
active nav item, visible focus rings on keyboard focus only, semantic buttons
and no clickable `div`s. `prefers-reduced-motion` is honoured globally.

## Motion

CSS transitions only, 150–250ms. No animation library: nothing here needs one.

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Read in one place. `apps/web/.env` is gitignored; `.env.example` documents it.

## Not built yet

Search and notifications render as **disabled** controls rather than faking
behaviour. Modules not built yet (team, documents, finance, calendar) show an honest
"in construction" state with no invented
data or charts. Component tests need jsdom and testing-library, which are not
installed; unit tests cover pure logic only.
