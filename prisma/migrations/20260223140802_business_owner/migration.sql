/*
  Warnings:

  - A unique constraint covering the columns `[businessOwnerId]` on the table `Business` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `businessOwnerId` to the `Business` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "businessOwnerId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Business_businessOwnerId_key" ON "Business"("businessOwnerId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_businessOwnerId_fkey" FOREIGN KEY ("businessOwnerId") REFERENCES "BusinessOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
