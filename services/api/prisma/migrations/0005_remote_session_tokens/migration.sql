ALTER TABLE "RemoteSession"
ADD COLUMN "connectionTokenHash" TEXT,
ADD COLUMN "connectionTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "connectionTokenUsedAt" TIMESTAMP(3);

CREATE INDEX "RemoteSession_connectionTokenExpiresAt_idx"
ON "RemoteSession"("connectionTokenExpiresAt");
