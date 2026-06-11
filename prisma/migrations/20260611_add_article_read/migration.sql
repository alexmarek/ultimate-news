-- CreateTable
CREATE TABLE "ArticleRead" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleRead_pkey" PRIMARY KEY ("userId","articleId")
);
