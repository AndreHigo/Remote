-- Register the intended remote engine before the native game client is enabled.
CREATE TYPE "RemoteSessionMode" AS ENUM ('SUPPORT', 'GAME');

ALTER TABLE "RemoteSession"
ADD COLUMN "mode" "RemoteSessionMode" NOT NULL DEFAULT 'SUPPORT';
