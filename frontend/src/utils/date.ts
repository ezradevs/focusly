/**
 * Date formatting utilities with internationalization support
 * Uses date-fns for consistent, locale-aware formatting
 */

import { format, formatDistanceToNow } from "date-fns";

/**
 * Format a date as a full date and time
 * Example: "Jan 1, 2024, 12:30 PM"
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "PPp"); // Uses locale from browser
}

/**
 * Format a date as just the date
 * Example: "Jan 1, 2024"
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "PP"); // Uses locale from browser
}

/**
 * Format a date as a short date
 * Example: "Jan 1"
 */
export function formatShortDate(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "MMM d");
}

/**
 * Format a date as a relative time
 * Example: "2 hours ago", "in 3 days"
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format a date with custom format
 */
export function formatCustom(date: Date | string | number, formatString: string): string {
  const d = new Date(date);
  return format(d, formatString);
}

/**
 * Format time only
 * Example: "12:30 PM"
 */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "p");
}

/**
 * Format date with weekday
 * Example: "Monday, Jan 1, 2024"
 */
export function formatDateWithWeekday(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "EEEE, PPP");
}

/**
 * Format date for form inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | number): string {
  const d = new Date(date);
  return format(d, "yyyy-MM-dd");
}
