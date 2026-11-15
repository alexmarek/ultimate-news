-- Additive only. Review and apply separately to a confirmed non-production database first.
CREATE TABLE "FactCheckUser" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "googleSubject" TEXT,
  "role" TEXT NOT NULL DEFAULT 'editor', "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FactCheckUser_email_key" ON "FactCheckUser"("email");
CREATE UNIQUE INDEX "FactCheckUser_googleSubject_key" ON "FactCheckUser"("googleSubject");

CREATE TABLE "FactCheckArticle" (
  "id" TEXT NOT NULL, "canonicalUrl" TEXT NOT NULL, "publishedReportId" TEXT, "activeJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckArticle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FactCheckArticle_canonicalUrl_key" ON "FactCheckArticle"("canonicalUrl");
CREATE UNIQUE INDEX "FactCheckArticle_publishedReportId_key" ON "FactCheckArticle"("publishedReportId");
CREATE UNIQUE INDEX "FactCheckArticle_activeJobId_key" ON "FactCheckArticle"("activeJobId");

CREATE TABLE "FactCheckReport" (
  "id" TEXT NOT NULL, "articleId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued', "title" TEXT, "publisher" TEXT, "author" TEXT,
  "articlePublishedAt" TIMESTAMP(3), "language" TEXT, "score" DOUBLE PRECISION, "verdict" TEXT,
  "confidence" TEXT, "executiveSummary" TEXT, "supportedFindings" JSONB, "unsupportedFindings" JSONB,
  "missingContext" JSONB, "accurateFormulation" TEXT, "verifiedAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3),
  "modelId" TEXT NOT NULL, "methodologyVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FactCheckReport_articleId_version_key" ON "FactCheckReport"("articleId", "version");
CREATE INDEX "FactCheckReport_status_verifiedAt_idx" ON "FactCheckReport"("status", "verifiedAt");

CREATE TABLE "FactCheckClaim" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "statement" TEXT NOT NULL, "importance" TEXT NOT NULL,
  "central" BOOLEAN NOT NULL, "score" DOUBLE PRECISION, "verdict" TEXT NOT NULL,
  "confidence" TEXT NOT NULL, "explanation" TEXT NOT NULL,
  CONSTRAINT "FactCheckClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FactCheckClaim_reportId_idx" ON "FactCheckClaim"("reportId");

CREATE TABLE "FactCheckEvidence" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "claimId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "publisher" TEXT, "url" TEXT NOT NULL, "publishedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL, "sourceType" TEXT NOT NULL, "provenance" TEXT,
  "excerpt" TEXT NOT NULL, "relationship" TEXT NOT NULL,
  CONSTRAINT "FactCheckEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FactCheckEvidence_reportId_claimId_idx" ON "FactCheckEvidence"("reportId", "claimId");

CREATE TABLE "FactCheckJob" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "workflowId" TEXT, "status" TEXT NOT NULL DEFAULT 'queued',
  "errorCategory" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "searchCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactCheckJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FactCheckJob_workflowId_key" ON "FactCheckJob"("workflowId");
CREATE INDEX "FactCheckJob_reportId_status_idx" ON "FactCheckJob"("reportId", "status");

ALTER TABLE "FactCheckArticle" ADD CONSTRAINT "FactCheckArticle_publishedReportId_fkey" FOREIGN KEY ("publishedReportId") REFERENCES "FactCheckReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FactCheckReport" ADD CONSTRAINT "FactCheckReport_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "FactCheckArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactCheckClaim" ADD CONSTRAINT "FactCheckClaim_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FactCheckReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactCheckEvidence" ADD CONSTRAINT "FactCheckEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FactCheckReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactCheckEvidence" ADD CONSTRAINT "FactCheckEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "FactCheckClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactCheckJob" ADD CONSTRAINT "FactCheckJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FactCheckReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
