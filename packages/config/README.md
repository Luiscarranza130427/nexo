# @nexo/config

Shared configuration for the Nexo monorepo.

Currently exposes a single TypeScript base (`tsconfig.base.json`) consumed by the
shared packages under `packages/*`.

`apps/web` and `apps/api` deliberately keep their own TypeScript configuration:
Next.js and NestJS each require compiler options that cannot be merged into one
base without breaking one of them. They will only adopt shared config if and when
it provides real value.
