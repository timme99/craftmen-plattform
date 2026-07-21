-- CreateEnum
CREATE TYPE "Salutation" AS ENUM ('HERR', 'FRAU');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "salutation" "Salutation";
