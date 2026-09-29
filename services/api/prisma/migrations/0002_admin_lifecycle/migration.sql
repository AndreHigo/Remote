-- Add a reversible lifecycle state for managed devices.
ALTER TABLE "Device" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Device_archivedAt_idx" ON "Device"("archivedAt");
