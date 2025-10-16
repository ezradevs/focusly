import { prisma } from "@/lib/prisma";

function isSQLite() {
  return process.env.DATABASE_URL?.startsWith("file:");
}

export async function ensureDatabase() {
  if (!isSQLite()) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ModuleOutput" (
      "id" TEXT PRIMARY KEY,
      "module" TEXT NOT NULL,
      "subject" TEXT,
      "label" TEXT,
      "input" TEXT NOT NULL,
      "output" TEXT NOT NULL,
      "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
      "userId" TEXT,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ModuleOutput_userId_idx"
    ON "ModuleOutput" ("userId");
  `);
}
