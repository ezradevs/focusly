import crypto from "crypto";

/**
 * Generate a random token for email verification or password reset
 * Returns both the raw token (to send to user) and hashed token (to store in database)
 */
export function generateToken(): { token: string; hashedToken: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(token);
  return { token, hashedToken };
}

/**
 * Hash a token using SHA-256
 * This is used to securely store tokens in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token matches the hashed version
 */
export function verifyToken(token: string, hashedToken: string): boolean {
  const hashedInput = hashToken(token);
  return hashedInput === hashedToken;
}
