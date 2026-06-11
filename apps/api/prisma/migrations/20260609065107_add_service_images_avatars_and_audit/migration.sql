-- CreateEnum
CREATE TYPE "EntityImageSource" AS ENUM ('URL', 'LOCAL');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('SERVICE', 'STAFF', 'CLIENT', 'PRODUCT', 'PROMOTION', 'RESERVATION', 'USER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'TOGGLED', 'STATUS_CHANGED', 'LOGIN', 'UPLOAD');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "coverUrl" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "ServiceImage" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "source" "EntityImageSource" NOT NULL DEFAULT 'URL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "detail" TEXT,
    "userId" INTEGER,
    "userKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceImage_serviceId_idx" ON "ServiceImage"("serviceId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ServiceImage" ADD CONSTRAINT "ServiceImage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
