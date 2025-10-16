import jwt, { type JwtPayload as BasePayload, type Secret } from "jsonwebtoken";

export interface AuthTokenPayload extends BasePayload {
  sub: string;
  email: string;
  name?: string | null;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable.");
}

const SIGNING_SECRET: Secret = JWT_SECRET;
const TOKEN_EXPIRY = "7d";
export const AUTH_COOKIE_NAME = "focusly_token";

export function createAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, SIGNING_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, SIGNING_SECRET);
    if (typeof decoded === "string") {
      return null;
    }
    return decoded as AuthTokenPayload;
  } catch (error) {
    return null;
  }
}
