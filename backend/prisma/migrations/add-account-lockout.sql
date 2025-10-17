-- Add account lockout fields to User table
-- Run this in Supabase SQL Editor

ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockoutUntil" TIMESTAMP(3);
