"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ModuleId } from "@/constants/modules";
import { usePreferencesStore } from "@/store/preferences";
import { NotesSummariserModule } from "@/components/modules/notes-summariser";
import { QuestionGeneratorModule } from "@/components/modules/question-generator";
import { QuizModeModule } from "@/components/modules/quiz-mode";
import { FlashcardMakerModule } from "@/components/modules/flashcard-maker";
import { ExamCreatorModule } from "@/components/modules/exam-creator";
import { RevisionPlannerModule } from "@/components/modules/revision-planner";
import { LanguagePracticeModule } from "@/components/modules/language-practice";
import { NESAExamModule } from "@/components/modules/nesa-exam";

export default function WorkspacePage() {
  const lastModule = usePreferencesStore((state) => state.lastModule);
  const updatePreferences = usePreferencesStore((state) => state.update);

  const [activeModule, setActiveModule] = useState<ModuleId>(lastModule);

  const handleModuleChange = (module: ModuleId) => {
    setActiveModule(module);
    updatePreferences({ lastModule: module });
  };

  const renderModule = () => {
    switch (activeModule) {
      case "notes":
        return <NotesSummariserModule key="notes" />;
      case "questions":
        return <QuestionGeneratorModule key="questions" />;
      case "quiz":
        return <QuizModeModule key="quiz" />;
      case "flashcards":
        return <FlashcardMakerModule key="flashcards" />;
      case "exam":
        return <ExamCreatorModule key="exam" />;
      case "planner":
        return <RevisionPlannerModule key="planner" />;
      case "language":
        return <LanguagePracticeModule key="language" />;
      case "nesa":
        return <NESAExamModule key="nesa" />;
      default:
        return <NotesSummariserModule key="notes" />;
    }
  };

  return (
    <DashboardShell
      activeModule={activeModule}
      onModuleChange={handleModuleChange}
    >
      {renderModule()}
    </DashboardShell>
  );
}
