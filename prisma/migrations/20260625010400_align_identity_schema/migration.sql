DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('client', 'business', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TwoFactorMethod" AS ENUM ('sms', 'authenticator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BusinessType" AS ENUM ('general_repair', 'specialized', 'body_paint', 'quick_service');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "EmployeeCount" AS ENUM ('small', 'medium', 'large');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'client';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "businessId" INTEGER;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "twoFactorMethod" "TwoFactorMethod";

ALTER TABLE "User"
ALTER COLUMN "phoneNumber" TYPE TEXT USING "phoneNumber"::TEXT,
ALTER COLUMN "phoneNumber" DROP NOT NULL;

UPDATE "User" AS u
SET
  "passwordHash" = COALESCE(NULLIF(u."passwordHash", ''), c."hash", ''),
  "role" = 'client'::"UserRole"
FROM "Client" AS c
WHERE c."userId" = u."id";

UPDATE "User" AS u
SET
  "passwordHash" = COALESCE(NULLIF(u."passwordHash", ''), b."hash", ''),
  "role" = 'business'::"UserRole",
  "businessId" = b."id"
FROM "BusinessOwner" AS bo
JOIN "Business" AS b ON b."businessOwnerId" = bo."id"
WHERE bo."userId" = u."id";

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "businessType" "BusinessType";

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "employeeCount" "EmployeeCount";

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "streetAddress" TEXT;

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "state" TEXT;

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "zipCode" TEXT;

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "workingHoursOpen" TEXT;

ALTER TABLE "Business"
ADD COLUMN IF NOT EXISTS "workingHoursClose" TEXT;

ALTER TABLE "Business"
ALTER COLUMN "phoneNumber" TYPE TEXT USING "phoneNumber"::TEXT,
ALTER COLUMN "commercialRegistraionNumber" TYPE BIGINT USING "commercialRegistraionNumber"::BIGINT,
ALTER COLUMN "taxIdentificationNumber" TYPE BIGINT USING "taxIdentificationNumber"::BIGINT;

ALTER TABLE "Business"
ALTER COLUMN "hash" SET DEFAULT '';

ALTER TABLE "Business"
ALTER COLUMN "businessOwnerId" DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE "User"
  ADD CONSTRAINT "User_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
