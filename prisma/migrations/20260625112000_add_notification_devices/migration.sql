-- Add device registrations for mobile/web push notification delivery.
CREATE TABLE "NotificationDevice" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT 'mobile',
    "deviceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InboxMessage" ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "NotificationDevice_token_key" ON "NotificationDevice"("token");
CREATE INDEX "NotificationDevice_userId_enabled_idx" ON "NotificationDevice"("userId", "enabled");
CREATE INDEX "NotificationDevice_platform_idx" ON "NotificationDevice"("platform");

ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
