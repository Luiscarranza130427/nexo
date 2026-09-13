-- Project codes are generated from a per-organization counter rather than from
-- COUNT(*) or MAX(code): the increment is atomic, so concurrent creates cannot
-- collide, and a number is never reused even if the newest project is deleted.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "projectCodeSequence" INTEGER NOT NULL DEFAULT 0;

-- Existing organizations start their counter past whatever codes already exist,
-- so a fresh project never clashes with a historical one.
UPDATE "Organization" o
SET "projectCodeSequence" = COALESCE(
  (
    SELECT MAX(NULLIF(regexp_replace(p."code", '\D', '', 'g'), '')::int)
    FROM "Project" p
    WHERE p."organizationId" = o."id"
  ),
  0
);

-- CreateIndex
CREATE INDEX "Project_organizationId_createdAt_idx" ON "Project"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_organizationId_dueDate_idx" ON "Project"("organizationId", "dueDate");
