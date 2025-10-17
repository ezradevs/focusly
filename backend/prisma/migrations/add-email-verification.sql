-- Add email verification fields to User table
ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verificationToken" TEXT,
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- Add unique constraint on verificationToken
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
