-- Indexes for the organization-wide task list: default ordering and due-date filters.
-- The board keeps using the existing (projectId, status, position) index.

-- CreateIndex
CREATE INDEX "Task_organizationId_createdAt_idx" ON "Task"("organizationId", "createdAt");
-- CreateIndex
CREATE INDEX "Task_organizationId_dueDate_idx" ON "Task"("organizationId", "dueDate");
