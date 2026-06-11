-- CreateTable
CREATE TABLE "ArticleSaved" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleSaved_pkey" PRIMARY KEY ("userId","articleId")
);
