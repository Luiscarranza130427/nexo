-- A document number identifies a client within its organization, not globally.
-- The plain index is replaced by a unique constraint (which is backed by an
-- index of its own, so nothing is lost). documentNumber is nullable and
-- PostgreSQL treats each NULL as distinct, so clients without a document still
-- coexist freely.

-- DropIndex
DROP INDEX "Client_organizationId_documentNumber_idx";

-- CreateIndex
CREATE INDEX "Client_organizationId_createdAt_idx" ON "Client"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_organizationId_status_idx" ON "Client"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Client_organizationId_documentNumber_key" ON "Client"("organizationId", "documentNumber");
