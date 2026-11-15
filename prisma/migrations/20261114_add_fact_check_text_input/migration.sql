ALTER TABLE "FactCheckArticle" ADD COLUMN "inputType" TEXT NOT NULL DEFAULT 'url';
ALTER TABLE "FactCheckArticle" ADD COLUMN "inputText" TEXT;
