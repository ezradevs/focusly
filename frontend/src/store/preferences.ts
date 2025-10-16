import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId } from "@/constants/modules";
import type { QuestionType, SubjectValue } from "@/types";

export type SummaryTone = "concise" | "exam-focus";

interface PreferencesState {
  subject: SubjectValue;
  tone: SummaryTone;
  questionCount: number;
  questionTypes: QuestionType[];
  includeMarkingGuides: boolean;
  lastModule: ModuleId;
  update: (payload: Partial<Omit<PreferencesState, "update">>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      subject: "biology",
      tone: "concise",
      questionCount: 5,
      questionTypes: ["mcq", "short-answer"],
      includeMarkingGuides: false,
      lastModule: "notes",
      update: (payload) =>
        set((state) => ({
          ...state,
          ...payload,
        })),
    }),
    {
      name: "focusly-preferences",
      version: 1,
    }
  )
);
