-- CreateTable
CREATE TABLE "inquiry_positions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "inquiryId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "inquiry_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_positions_inquiryId_positionId_key" ON "inquiry_positions"("inquiryId", "positionId");

-- CreateIndex
CREATE INDEX "inquiry_positions_positionId_idx" ON "inquiry_positions"("positionId");

-- AddForeignKey
ALTER TABLE "inquiry_positions" ADD CONSTRAINT "inquiry_positions_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_positions" ADD CONSTRAINT "inquiry_positions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
