"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { ModuleId } from "@/constants/modules";
import { usePreferencesStore } from "@/store/preferences";
import { useAuthStore } from "@/store/auth";
import { NotesSummariserModule } from "@/components/modules/notes-summariser";
import { QuestionGeneratorModule } from "@/components/modules/question-generator";
import { QuizModeModule } from "@/components/modules/quiz-mode";
import { FlashcardMakerModule } from "@/components/modules/flashcard-maker";
import { ExamCreatorModule } from "@/components/modules/exam-creator";
import { RevisionPlannerModule } from "@/components/modules/revision-planner";
import { LanguagePracticeModule } from "@/components/modules/language-practice";
import { NESAExamModule } from "@/components/modules/nesa-exam";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { focuslyApi } from "@/lib/api";

export default function WorkspacePage() {
  const lastModule = usePreferencesStore((state) => state.lastModule);
  const updatePreferences = usePreferencesStore((state) => state.update);
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const [activeModule, setActiveModule] = useState<ModuleId>(lastModule);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const isLoggedIn = status === "authenticated" && user;
  const isEmailVerified = isLoggedIn && user.emailVerified;

  const handleModuleChange = (module: ModuleId) => {
    setActiveModule(module);
    updatePreferences({ lastModule: module });
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResendingVerification(true);
    try {
      // We don't have a resend endpoint, so we'll just show a message
      toast.info("Please check your email for the verification link sent when you signed up.");
    } catch (error) {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResendingVerification(false);
    }
  };

  const renderModule = () => {
    // Block AI access if logged in but not verified
    if (isLoggedIn && !isEmailVerified) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <Alert className="max-w-2xl border-yellow-500/50 bg-yellow-500/10">
            <MailWarning className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
              Email Verification Required
            </AlertTitle>
            <AlertDescription className="mt-2 text-yellow-800 dark:text-yellow-200">
              <p className="mb-4">
                To use Focusly's AI-powered learning modules, please verify your email address.
                We sent a verification link to <strong>{user.email}</strong> when you signed up.
              </p>
              <p className="mb-4 text-sm">
                Check your spam folder if you don't see it. The verification link expires after 24 hours.
              </p>
              <Button
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                variant="outline"
                className="mt-2"
              >
                Check Email Instructions
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
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
