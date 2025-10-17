/**
 * Basic input sanitization to prevent XSS attacks
 * Removes potentially dangerous HTML/script tags and normalizes input
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // Event handlers
  /javascript:/gi,
  /data:text\/html/gi,
];

/**
 * Sanitize a string by removing dangerous patterns
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Normalize whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}
