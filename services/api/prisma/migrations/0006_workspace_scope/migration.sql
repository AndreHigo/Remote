-- Make the deployment boundary explicit before the platform is exposed online.
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Workspace" ("id", "name", "updatedAt")
VALUES ('ws_default', 'Workspace Remoto', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "User" ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'ws_default';
ALTER TABLE "Customer" ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'ws_default';

CREATE INDEX "User_workspaceId_idx" ON "User"("workspaceId");
CREATE INDEX "Customer_workspaceId_idx" ON "Customer"("workspaceId");

ALTER TABLE "User"
ADD CONSTRAINT "User_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
