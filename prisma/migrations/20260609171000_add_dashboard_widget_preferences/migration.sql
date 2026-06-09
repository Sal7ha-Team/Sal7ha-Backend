-- CreateTable
CREATE TABLE "DashboardWidgetPreference" (
    "userId" INTEGER NOT NULL,
    "activeWidgetIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardWidgetPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "DashboardWidgetPreference" ADD CONSTRAINT "DashboardWidgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

