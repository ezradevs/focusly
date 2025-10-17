import type { Request, Response, NextFunction } from "express";
import { sanitizeObject } from "../utils/sanitize";

/**
 * Middleware to sanitize all incoming request bodies
 * This helps prevent XSS attacks by removing dangerous patterns from user input
 */
export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}
