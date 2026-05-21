-- CreateEnum
CREATE TYPE "ReservationChannel" AS ENUM ('WHATSAPP', 'WEB', 'PRESENCIAL', 'REDES');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDIENTE_ADELANTO', 'CONFIRMADA', 'EN_PROCESO', 'ATENDIDA', 'CANCELADA', 'NO_SHOW', 'VENCIDA');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADELANTO', 'SALDO', 'TOTAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'YAPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMADO', 'ANULADO', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PORCENTAJE', 'MONTO', 'REGALO');

-- CreateEnum
CREATE TYPE "LoyaltyType" AS ENUM ('CUMPLEANIOS', 'REFERIDO', 'CLIENTE_FIEL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'OCULTA');

-- CreateEnum
CREATE TYPE "AlbumPrivacy" AS ENUM ('INTERNO', 'PRIVADO_CLIENTE', 'PUBLICO');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('ANTES', 'DESPUES', 'RESULTADO');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('WHATSAPP', 'FIRMA', 'VERBAL', 'OTRO');

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "BusinessConfig" (
    "id" SERIAL NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Gisela Mora SPA-BARBER',
    "personType" TEXT NOT NULL DEFAULT 'NATURAL',
    "docType" TEXT NOT NULL DEFAULT 'DNI',
    "docNumber" TEXT,
    "requiresAdvance" BOOLEAN NOT NULL DEFAULT true,
    "advanceType" TEXT NOT NULL DEFAULT 'PORCENTAJE',
    "advanceValue" DECIMAL(10,2) NOT NULL DEFAULT 30.0,
    "minAdvanceMinutes" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "BusinessConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL,
    "priceBase" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffService" (
    "staffId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("staffId","serviceId")
);

-- CreateTable
CREATE TABLE "SalonSchedule" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift1Start" TIME NOT NULL,
    "shift1End" TIME NOT NULL,
    "shift2Start" TIME,
    "shift2End" TIME,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SalonSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift1Start" TIME NOT NULL,
    "shift1End" TIME NOT NULL,
    "shift2Start" TIME,
    "shift2End" TIME,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaBlock" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "AgendaBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'DNI',
    "docNumber" TEXT,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT,
    "whatsapp" TEXT,
    "birthDate" TIMESTAMP(3),
    "referredById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "channel" "ReservationChannel" NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationDetail" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "staffId" INTEGER,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "priceList" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReservationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationHistory" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "userId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "type" "PaymentType" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMADO',

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptRef" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'BOLETA',
    "seriesNumber" TEXT,
    "external" BOOLEAN NOT NULL DEFAULT true,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "value" DECIMAL(10,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "channel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionService" (
    "promotionId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "PromotionService_pkey" PRIMARY KEY ("promotionId","serviceId")
);

-- CreateTable
CREATE TABLE "ReservationPromotion" (
    "reservationId" INTEGER NOT NULL,
    "promotionId" INTEGER NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ReservationPromotion_pkey" PRIMARY KEY ("reservationId","promotionId")
);

-- CreateTable
CREATE TABLE "LoyaltyBenefit" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "type" "LoyaltyType" NOT NULL,
    "description" TEXT,
    "value" DECIMAL(10,2),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSale" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER,
    "method" "PaymentMethod" NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSaleDetail" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ProductSaleDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDIENTE',
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "privacy" "AlbumPrivacy" NOT NULL DEFAULT 'INTERNO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumPhoto" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'RESULTADO',
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" INTEGER,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AlbumPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageConsent" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "internalUse" BOOLEAN NOT NULL DEFAULT true,
    "marketingUse" BOOLEAN NOT NULL DEFAULT false,
    "method" "ConsentMethod" NOT NULL,
    "notes" TEXT,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredById" INTEGER,

    CONSTRAINT "ImageConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageService" (
    "packageId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "PackageService_pkey" PRIMARY KEY ("packageId","serviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reservationId_key" ON "Review"("reservationId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaBlock" ADD CONSTRAINT "AgendaBlock_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationDetail" ADD CONSTRAINT "ReservationDetail_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationDetail" ADD CONSTRAINT "ReservationDetail_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationDetail" ADD CONSTRAINT "ReservationDetail_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptRef" ADD CONSTRAINT "ReceiptRef_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionService" ADD CONSTRAINT "PromotionService_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionService" ADD CONSTRAINT "PromotionService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPromotion" ADD CONSTRAINT "ReservationPromotion_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPromotion" ADD CONSTRAINT "ReservationPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyBenefit" ADD CONSTRAINT "LoyaltyBenefit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleDetail" ADD CONSTRAINT "ProductSaleDetail_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ProductSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleDetail" ADD CONSTRAINT "ProductSaleDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumPhoto" ADD CONSTRAINT "AlbumPhoto_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumPhoto" ADD CONSTRAINT "AlbumPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageConsent" ADD CONSTRAINT "ImageConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageConsent" ADD CONSTRAINT "ImageConsent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageConsent" ADD CONSTRAINT "ImageConsent_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageService" ADD CONSTRAINT "PackageService_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageService" ADD CONSTRAINT "PackageService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
