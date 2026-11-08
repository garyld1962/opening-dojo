-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "openingSlug" TEXT NOT NULL,
    "expectedSan" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewCard_userId_due_idx" ON "ReviewCard"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_userId_cardKey_key" ON "ReviewCard"("userId", "cardKey");

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

