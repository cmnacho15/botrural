/*
  Warnings:

  - A unique constraint covering the columns `[telefono]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "TipoEvento" ADD VALUE 'GASTO';

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "iva" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastMessageAt" TIMESTAMP(6),
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(6),
ADD COLUMN     "onboardingStartedAt" TIMESTAMP(6),
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "whatsappState" TEXT DEFAULT 'IDLE',
ALTER COLUMN "role" SET DEFAULT 'USUARIO';

-- CreateIndex
CREATE UNIQUE INDEX "User_telefono_key" ON "User"("telefono");
