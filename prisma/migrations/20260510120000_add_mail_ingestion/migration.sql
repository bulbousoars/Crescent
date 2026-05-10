-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptedTokens" BYTEA NOT NULL,
    "cursor" TEXT NOT NULL DEFAULT '',
    "rules" JSONB,
    "pollIntervalSec" INTEGER NOT NULL DEFAULT 120,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerMsgId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL DEFAULT '',
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "errorReason" TEXT NOT NULL DEFAULT '',
    "listingId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_provider_email_key" ON "MailAccount"("provider", "email");

-- CreateIndex
CREATE INDEX "MailAccount_enabled_lastSyncAt_idx" ON "MailAccount"("enabled", "lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_accountId_providerMsgId_key" ON "MailMessage"("accountId", "providerMsgId");

-- CreateIndex
CREATE INDEX "MailMessage_status_idx" ON "MailMessage"("status");

-- CreateIndex
CREATE INDEX "MailMessage_accountId_receivedAt_idx" ON "MailMessage"("accountId", "receivedAt");

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
