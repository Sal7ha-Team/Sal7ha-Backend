CREATE TABLE IF NOT EXISTS "BankDetails" (
  "id" SERIAL NOT NULL,
  "businessId" INTEGER NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "iban" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankDetails_businessId_key"
ON "BankDetails"("businessId");

DO $$
BEGIN
  ALTER TABLE "BankDetails"
  ADD CONSTRAINT "BankDetails_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
