-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('NOTES_SUMMARY', 'QUESTION_SET', 'QUIZ_SESSION', 'FLASHCARD_DECK', 'EXAM_PACK', 'REVISION_PLAN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleOutput" (
    "id" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "subject" TEXT,
    "label" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ModuleOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ModuleOutput" ADD CONSTRAINT "ModuleOutput_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add LANGUAGE_PRACTICE to ModuleType enum
ALTER TYPE "ModuleType" ADD VALUE 'LANGUAGE_PRACTICE';
