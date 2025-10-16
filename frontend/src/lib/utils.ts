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
 * Format subject name to title case (e.g., "mathematics" -> "Mathematics")
 */
export function formatSubject(subject: string | null | undefined): string {
  if (!subject) return "";
  return subject
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
