# Conventions

## Language

- **Code is written in English** — identifiers, comments, commit messages,
  documentation, branch names.
- **User-facing interface text may be in Spanish.** It is content, not code.

## TypeScript

- TypeScript everywhere. No plain JavaScript source files.
- `strict` mode stays on.
- **Avoid `any`.** If it is genuinely unavoidable, narrow the scope as much as
  possible and leave a comment explaining why. Prefer `unknown` plus a type guard.
- Prefer explicit return types on exported functions.
- Types shared by frontend and backend belong in `packages/types`, not duplicated.

## Naming

| Thing                        | Convention             | Example              |
| ---------------------------- | ---------------------- | -------------------- |
| Folders                      | `kebab-case`           | `client-projects/`   |
| Non-component files          | `kebab-case`           | `format-currency.ts` |
| React components (and files) | `PascalCase`           | `ClientCard.tsx`     |
| Types, interfaces, enums     | `PascalCase`           | `ApiStatus`          |
| Functions and variables      | `camelCase`            | `getActiveClients`   |
| Constants (true constants)   | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_SIZE`    |

Names should say what something is or does. Avoid abbreviations that only make
sense to whoever wrote them.

## Structure

- **Keep files small.** A file that does several unrelated things should be split.
- **Do not duplicate.** Before writing a component, service, utility or type,
  check whether an equivalent already exists.
- **Keep business logic out of visual components.** Components render; logic lives
  in services, hooks or modules.
- **Frontend and backend stay separate.** They communicate over HTTP, never by
  importing each other's internals.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short imperative summary>
```

Types in use: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`,
`ci`, `style`.

```
feat: add client list view
fix: reject expired refresh tokens
chore: setup Nexo monorepo
```

## Formatting and linting

- Prettier owns formatting; its configuration lives at the repository root.
- `apps/web` uses ESLint (`eslint-config-next`).
- `apps/api` uses oxlint, the linter the NestJS CLI generates.
- Never silence a rule just to get a green run. Fix the cause, or document why the
  exception is correct.

## Before finishing a task

```bash
pnpm lint
pnpm typecheck
pnpm build
```

All three must pass. Run tests too, once they exist.
