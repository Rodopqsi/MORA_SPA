-- AlterTable
ALTER TABLE "ServiceImage" ADD COLUMN     "cloudinaryPublicId" TEXT;

-- CreateTable
CREATE TABLE "PromotionImage" (
    "id" SERIAL NOT NULL,
    "promotionId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "source" "EntityImageSource" NOT NULL DEFAULT 'URL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "cloudinaryPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionImage_promotionId_idx" ON "PromotionImage"("promotionId");

-- AddForeignKey
ALTER TABLE "PromotionImage" ADD CONSTRAINT "PromotionImage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
