import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format question type for display (e.g., "mcq" -> "MCQ", "short-answer" -> "Short Answer")
 */
export function formatQuestionType(type: string): string {
  if (type === "mcq") return "MCQ";
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format subject name to title case
 * Examples:
 * - "mathematics" -> "Mathematics"
 * - "software-engineering" -> "Software Engineering"
 * - "COMPUTER SCIENCE" -> "Computer Science"
 */
export function formatSubject(subject: string | null | undefined): string {
  if (!subject) return "";

  // Replace hyphens and underscores with spaces, then split
  const normalized = subject.replace(/[-_]/g, " ");

  return normalized
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(" ");
}
