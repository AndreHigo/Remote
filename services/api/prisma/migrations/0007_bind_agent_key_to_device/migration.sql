ALTER TABLE "AgentEnrollmentKey" ADD COLUMN "boundRemoteId" TEXT;

CREATE INDEX "AgentEnrollmentKey_boundRemoteId_idx" ON "AgentEnrollmentKey"("boundRemoteId");
