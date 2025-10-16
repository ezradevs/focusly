import type { NextFunction, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/utils/jwt";

const AUTH_HEADER_PREFIX = "bearer ";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Response | Promise<void | Response>;

export const withErrorBoundary = (handler: AsyncHandler): AsyncHandler => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
};

function extractToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (authorization && authorization.toLowerCase().startsWith(AUTH_HEADER_PREFIX)) {
    return authorization.slice(AUTH_HEADER_PREFIX.length).trim();
  }

  const tokenFromCookie = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof tokenFromCookie === "string" && tokenFromCookie.length > 0) {
    return tokenFromCookie;
  }
  return null;
}

export const attachUser: AsyncHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    return next();
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return next();
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (user) {
    req.currentUser = user;
  }

  next();
};

export const requireAuth: AsyncHandler = (req, res, next) => {
  if (!req.currentUser) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
};
