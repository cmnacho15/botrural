-- ===============================================
-- MIGRACIÓN: Mega Admin Panel
-- Ejecutar en tu base de datos PostgreSQL
-- ===============================================

-- 1. Agregar nuevo valor al enum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MEGA_ADMIN';

-- 2. Agregar nuevos campos al modelo User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(6);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'TRIAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3);

-- 3. Crear tabla AIUsage
CREATE TABLE IF NOT EXISTS "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUSD" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIUsage_userId_idx" ON "AIUsage"("userId");
CREATE INDEX IF NOT EXISTS "AIUsage_provider_idx" ON "AIUsage"("provider");
CREATE INDEX IF NOT EXISTS "AIUsage_feature_idx" ON "AIUsage"("feature");
CREATE INDEX IF NOT EXISTS "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");

-- 4. Crear tabla BotMessage
CREATE TABLE IF NOT EXISTS "BotMessage" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT,
    "mediaUrl" TEXT,
    "status" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseTime" INTEGER,
    "aiTokensUsed" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BotMessage_waId_idx" ON "BotMessage"("waId");
CREATE INDEX IF NOT EXISTS "BotMessage_telefono_idx" ON "BotMessage"("telefono");
CREATE INDEX IF NOT EXISTS "BotMessage_direction_idx" ON "BotMessage"("direction");
CREATE INDEX IF NOT EXISTS "BotMessage_createdAt_idx" ON "BotMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "BotMessage_status_idx" ON "BotMessage"("status");

-- 5. Crear tabla ActivityLog
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "campoId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_campoId_idx" ON "ActivityLog"("campoId");
CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- 6. Agregar foreign keys
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===============================================
-- Para asignar MEGA_ADMIN a un usuario:
-- UPDATE "User" SET "role" = 'MEGA_ADMIN' WHERE "email" = 'tu@email.com';
-- ===============================================
