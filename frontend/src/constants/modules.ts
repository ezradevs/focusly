import type { StoredModuleType } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Languages,
  Layers3,
  NotebookPen,
} from "lucide-react";

export type ModuleId =
  | "notes"
  | "questions"
  | "quiz"
  | "flashcards"
  | "exam"
  | "planner"
  | "language";

export interface ModuleMeta {
  id: ModuleId;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

export const MODULES: ModuleMeta[] = [
  {
    id: "notes",
    label: "Notes Summariser",
    description: "Turn messy notes into concise study packs.",
    icon: NotebookPen,
    accent: "from-sky-400 to-blue-600",
  },
  {
    id: "questions",
    label: "Question Generator",
    description: "Generate MCQ, short, and extended response practice.",
    icon: ClipboardList,
    accent: "from-violet-400 to-purple-600",
  },
  {
    id: "quiz",
    label: "Quiz Mode",
    description: "Run adaptive quizzes with instant feedback.",
    icon: GraduationCap,
    accent: "from-emerald-400 to-teal-600",
  },
  {
    id: "flashcards",
    label: "Flashcard Maker",
    description: "Craft rich flashcards, cloze deletions, and occlusion cards.",
    icon: Layers3,
    accent: "from-amber-400 to-orange-600",
  },
  {
    id: "exam",
    label: "Exam-Style Creator",
    description: "Build full-length responses with optional band 6 exemplars.",
    icon: BookOpenCheck,
    accent: "from-rose-400 to-red-600",
  },
  {
    id: "planner",
    label: "Revision Planner",
    description: "Design a week-by-week revision roadmap.",
    icon: FileSpreadsheet,
    accent: "from-lime-400 to-green-600",
  },
  {
    id: "language",
    label: "Language Practice",
    description: "Practice vocabulary, grammar, conversation, and translation.",
    icon: Languages,
    accent: "from-cyan-400 to-blue-600",
  },
];

export const MODULE_TYPE_MAP: Record<StoredModuleType, ModuleId> = {
  NOTES_SUMMARY: "notes",
  QUESTION_SET: "questions",
  QUIZ_SESSION: "quiz",
  FLASHCARD_DECK: "flashcards",
  EXAM_PACK: "exam",
  REVISION_PLAN: "planner",
  LANGUAGE_PRACTICE: "language",
};
