DO $$
BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('In_Progress', 'Completed', 'Pending', 'Cancelled', 'Accepted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Service" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceConfigOption" (
  "id" SERIAL NOT NULL,
  "categoryId" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "ServiceConfigOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BusinessService" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "BusinessService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BusinessInventory" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "categoryId" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "BusinessInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phoneNumber" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Car" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" TEXT NOT NULL,
  "plate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT NOT NULL,
  "businessId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "carId" INTEGER NOT NULL,
  "serviceId" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'Pending',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BookingServiceDetail" (
  "id" SERIAL NOT NULL,
  "bookingId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "BookingServiceDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceConfigOption_categoryId_configKey_value_key"
ON "ServiceConfigOption"("categoryId", "configKey", "value");

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessService_businessId_serviceId_key"
ON "BusinessService"("businessId", "serviceId");

CREATE INDEX IF NOT EXISTS "Booking_businessId_status_idx"
ON "Booking"("businessId", "status");

CREATE INDEX IF NOT EXISTS "Booking_businessId_startDate_idx"
ON "Booking"("businessId", "startDate");

DO $$
BEGIN
  ALTER TABLE "Service"
  ADD CONSTRAINT "Service_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ServiceConfigOption"
  ADD CONSTRAINT "ServiceConfigOption_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BusinessService"
  ADD CONSTRAINT "BusinessService_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BusinessService"
  ADD CONSTRAINT "BusinessService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BusinessInventory"
  ADD CONSTRAINT "BusinessInventory_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BusinessInventory"
  ADD CONSTRAINT "BusinessInventory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Car"
  ADD CONSTRAINT "Car_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_carId_fkey"
  FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BookingServiceDetail"
  ADD CONSTRAINT "BookingServiceDetail_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
