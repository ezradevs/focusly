"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  Trash2,
  Calendar,
  BookOpen,
  Flag,
  Pencil,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { focuslyApi } from "@/lib/api";
import type { NESAExam, NESAQuestion, NESAModuleName, ModuleOutputRecord, NESAMarkedAttempt } from "@/types";
import { PythonEditor } from "@/components/nesa/python-editor";
import { SQLEditor } from "@/components/nesa/sql-editor";
import { DiagramCanvas } from "@/components/nesa/diagram-canvas";
import { MatchingQuestion } from "@/components/nesa/matching-question";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  modules: z.array(z.string()).min(1, "Select at least one module"),
  questionCount: z.number().min(15).max(30),
  seed: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const NESA_MODULES: NESAModuleName[] = [
  "Secure Software Architecture",
  "Programming for the Web",
  "Software Engineering Project",
  "Automation",
];

export function NESAExamModule() {
  const [generating, setGenerating] = useState(false);
  const [exam, setExam] = useState<NESAExam | null>(null);
  const [examRecordId, setExamRecordId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [savedExams, setSavedExams] = useState<ModuleOutputRecord[]>([]);
  const [userAttempts, setUserAttempts] = useState<ModuleOutputRecord[]>([]);
  const [userProgress, setUserProgress] = useState<ModuleOutputRecord[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminDialogMessage, setAdminDialogMessage] = useState("");
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [markedAttempt, setMarkedAttempt] = useState<NESAMarkedAttempt | null>(null);
  const [markedAttemptRecordId, setMarkedAttemptRecordId] = useState<string | null>(null);
  const [selfMarkedScores, setSelfMarkedScores] = useState<Record<string, number>>({});
  const currentUser = useAuthStore((state) => state.user);
  const isEzraUser =
    currentUser?.name?.trim().toLowerCase() === "ezra" ||
    currentUser?.email?.split("@")[0]?.toLowerCase() === "ezra";

  const deriveCurrentUserDisplayName = () =>
    currentUser?.name?.trim() || currentUser?.email?.split("@")[0] || null;

  const applyLocalCreatorAttribution = (records: ModuleOutputRecord[]) => {
    const localDisplayName = deriveCurrentUserDisplayName();
    if (!currentUser?.id || !localDisplayName) {
      return records;
    }

    return records.map((record) => {
      const existingName = typeof record.createdByName === "string" ? record.createdByName.trim() : "";
      if (existingName) {
        return record;
      }
      if (record.userId !== currentUser.id) {
        return record;
      }
      return { ...record, createdByName: localDisplayName };
    });
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modules: [],
      questionCount: 25,
      seed: "",
    },
  });

  const selectedModules = watch("modules");

  useEffect(() => {
    const loadExamsAndAttempts = async () => {
      setLoadingExams(true);
      try {
        const [{ exams }, { attempts }, { progress }] = await Promise.all([
          focuslyApi.getNESAExams(),
          focuslyApi.getNESAAttempts(),
          focuslyApi.getNESAProgress(),
        ]);
        setSavedExams(applyLocalCreatorAttribution(exams));
        setUserAttempts(attempts);
        setUserProgress(progress);
      } catch (error) {
      } finally {
        setLoadingExams(false);
      }
    };

    loadExamsAndAttempts();
  }, [currentUser]);

  // Auto-save progress when answers change
  useEffect(() => {
    if (!exam || !examRecordId || Object.keys(userAnswers).length === 0) return;

    const saveProgress = async () => {
      try {
        await focuslyApi.saveNESAProgress({
          examId: examRecordId, // Use the actual exam record ID
          examTitle: exam.examTitle,
          userAnswers,
          currentQuestionIndex,
        });
      } catch (error) {
        // Silent fail - don't interrupt user experience
        console.error("Failed to save progress:", error);
      }
    };

    // Debounce the save
    const timeoutId = setTimeout(saveProgress, 1000);
    return () => clearTimeout(timeoutId);
  }, [exam, examRecordId, userAnswers, currentQuestionIndex]);

  // Auto-save self-marked scores when they change
  useEffect(() => {
    if (!markedAttemptRecordId || Object.keys(selfMarkedScores).length === 0) return;

    const saveSelfMarks = async () => {
      try {
        await focuslyApi.updateNESAAttemptSelfMarks(markedAttemptRecordId, selfMarkedScores);
      } catch (error) {
        // Silent fail - don't interrupt user experience
        console.error("Failed to save self-marked scores:", error);
      }
    };

    // Debounce the save
    const timeoutId = setTimeout(saveSelfMarks, 1000);
    return () => clearTimeout(timeoutId);
  }, [markedAttemptRecordId, selfMarkedScores]);

  const toggleModule = (module: string) => {
    const current = selectedModules || [];
    if (current.includes(module)) {
      setValue("modules", current.filter((m) => m !== module));
    } else {
      setValue("modules", [...current, module]);
    }
  };

  const onSubmit = async (data: FormData) => {
    setGenerating(true);
    try {
      const result = await focuslyApi.generateNESAExam({
        modules: data.modules as NESAModuleName[],
        questionCount: data.questionCount,
        includeMarkingGuide: true,
        seed: data.seed || undefined,
      });
      setExam(result);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setFlaggedQuestions([]);
      setEditingExamId(null);
      setEditingLabel("");
      toast.success("Exam generated successfully!");

      // Refresh saved exams list
      const { exams } = await focuslyApi.getNESAExams();
      setSavedExams(applyLocalCreatorAttribution(exams));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate exam";
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleContinueExam = (savedExam: ModuleOutputRecord, progressData?: ModuleOutputRecord) => {
    const examData = savedExam.output as NESAExam;
    setExam(examData);
    setExamRecordId(savedExam.id); // Set the exam record ID
    setMarkedAttempt(null);

    // If progress exists, load it
    if (progressData) {
      const progress = progressData.output as {
        userAnswers?: Record<string, string>;
        currentQuestionIndex?: number;
      };
      setUserAnswers(progress.userAnswers || {});
      setCurrentQuestionIndex(progress.currentQuestionIndex || 0);
    } else {
      setUserAnswers({});
      setCurrentQuestionIndex(0);
    }

    setFlaggedQuestions([]);
    setEditingExamId(null);
    setEditingLabel("");
  };

  const handleViewAttempt = (attempt: ModuleOutputRecord) => {
    const attemptData = attempt.output as NESAMarkedAttempt;
    setMarkedAttempt(attemptData);
    setMarkedAttemptRecordId(attempt.id);

    // Load self-marked scores from the attempt
    const loadedSelfMarks: Record<string, number> = {};
    attemptData.marks.forEach((mark) => {
      if (mark.selfMarkedScore !== undefined) {
        loadedSelfMarks[mark.questionId] = mark.selfMarkedScore;
      }
    });
    setSelfMarkedScores(loadedSelfMarks);

    setExam(null);
    setExamRecordId(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setFlaggedQuestions([]);
    setEditingExamId(null);
    setEditingLabel("");
  };

  const handleDeleteExam = async (id: string) => {
    try {
      const deletedExam = savedExams.find((examRecord) => examRecord.id === id);
      await focuslyApi.deleteNESAExam(id);
      setSavedExams((prev) => prev.filter((e) => e.id !== id));
      toast.success("Exam deleted");

      if (exam && deletedExam) {
        const deletedTitle = (deletedExam.output as NESAExam).examTitle;
        if (exam.examTitle === deletedTitle) {
          setExam(null);
          setExamRecordId(null);
          setFlaggedQuestions([]);
          setUserAnswers({});
        }
      }
    } catch (error: unknown) {
      const apiError = error as Error & { status?: number };
      const errorMessage = apiError instanceof Error ? apiError.message : "Failed to delete exam";
      if (apiError?.status === 403) {
        setAdminDialogMessage(errorMessage);
        setAdminDialogOpen(true);
        return;
      }
      toast.error(errorMessage);
    }
  };

  const startRenamingExam = (record: ModuleOutputRecord) => {
    const examData = record.output as NESAExam;
    setEditingExamId(record.id);
    setEditingLabel(record.label?.trim() || examData.examTitle);
  };

  const cancelRenaming = () => {
    setEditingExamId(null);
    setEditingLabel("");
  };

  const handleRenameExam = async () => {
    if (!editingExamId) return;
    const trimmed = editingLabel.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }

    setRenameLoading(true);
    try {
      const { exam: updatedExam } = await focuslyApi.renameNESAExam(editingExamId, trimmed);
      const [normalizedExam] = applyLocalCreatorAttribution([updatedExam]);
      const examWithAttribution = normalizedExam ?? updatedExam;
      setSavedExams((prev) =>
        prev.map((record) =>
          record.id === editingExamId ? { ...record, ...examWithAttribution } : record
        )
      );
      toast.success("Exam renamed");
      setEditingExamId(null);
      setEditingLabel("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to rename exam";
      toast.error(errorMessage);
    } finally {
      setRenameLoading(false);
    }
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((flaggedId) => flaggedId !== questionId)
        : [...prev, questionId]
    );
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleFinishExam = () => {
    setFinishDialogOpen(true);
  };

  const handleRequestMarking = async () => {
    if (!exam) return;

    setIsMarking(true);
    setFinishDialogOpen(false);

    try {
      // Convert userAnswers to the format expected by the API
      const answers = Object.entries(userAnswers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      const result = await focuslyApi.markNESAExam({
        examTitle: exam.examTitle,
        examRecordId: examRecordId || undefined,
        questions: exam.questions,
        userAnswers: answers,
      });

      setMarkedAttempt(result);
      if (result.savedRecordId) {
        setMarkedAttemptRecordId(result.savedRecordId);
      }
      toast.success("Exam marked successfully!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mark exam";
      toast.error(errorMessage);
    } finally {
      setIsMarking(false);
    }
  };

  const handleRetakeExam = () => {
    if (!markedAttempt) return;

    // Load the exam questions but clear answers
    setExam({
      examTitle: markedAttempt.examTitle,
      questions: markedAttempt.questions,
      totalMarks: markedAttempt.totalPossible,
      timeAllowed: 180,
      instructions: [
        "Attempt ALL questions",
        "Write using black pen",
        "For coding questions, you may test your code in the provided editor",
        "Diagrams must be clearly labelled",
        `Total marks: ${markedAttempt.totalPossible}`,
        "Reading time: 5 minutes",
        "Working time: 3 hours"
      ],
      markingGuide: undefined
    });
    setMarkedAttempt(null);
    setMarkedAttemptRecordId(null);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setFlaggedQuestions([]);
    setSelfMarkedScores({});
    toast.success("Exam ready to retake!");
  };

  const handleRemarkExam = async () => {
    if (!markedAttempt) return;

    setIsMarking(true);

    try {
      // Reconstruct user answers from the marked attempt
      const answers = markedAttempt.marks.map((mark) => ({
        questionId: mark.questionId,
        answer: mark.userAnswer,
      }));

      const result = await focuslyApi.markNESAExam({
        examTitle: markedAttempt.examTitle,
        examRecordId: markedAttempt.examRecordId || undefined,
        questions: markedAttempt.questions,
        userAnswers: answers,
      });

      // Update the marked attempt with new results
      setMarkedAttempt(result);
      if (result.savedRecordId) {
        setMarkedAttemptRecordId(result.savedRecordId);
      }
      // Clear self-marked scores since we're remarking
      setSelfMarkedScores({});
      toast.success("Exam remarked successfully!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remark exam";
      toast.error(errorMessage);
    } finally {
      setIsMarking(false);
    }
  };

  const exportExamAsJSON = () => {
    if (!exam) return;
    const blob = new Blob([JSON.stringify(exam, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "NESA_Exam.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exam exported as JSON");
  };

  const currentQuestion = exam?.questions[currentQuestionIndex];
  const isCurrentQuestionFlagged = currentQuestion
    ? flaggedQuestions.includes(currentQuestion.id)
    : false;

  const renderQuestion = (question: NESAQuestion) => {
    switch (question.type) {
      case "mcq":
        return (
          <div className="space-y-4">
            <div className="text-lg font-medium">{question.prompt}</div>
            <div className="space-y-2">
              {question.options?.map((option) => (
                <label
                  key={option.label}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition"
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.label}
                    checked={userAnswers[question.id] === option.label}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  />
                  <div>
                    <span className="font-semibold">{option.label}.</span> {option.value}
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case "matching":
        // Parse existing answer if it exists
        const existingMatches: Record<number, number> = {};
        if (userAnswers[question.id]) {
          try {
            const parsed = JSON.parse(userAnswers[question.id]);
            Object.assign(existingMatches, parsed);
          } catch {
            // If not JSON, ignore
          }
        }

        return (
          <div className="space-y-4">
            <div className="text-lg font-medium mb-4">{question.prompt}</div>
            <MatchingQuestion
              pairs={question.matchingPairs || []}
              initialMatches={existingMatches}
              onMatchChange={(matches) => {
                // Store matches as JSON string
                handleAnswerChange(question.id, JSON.stringify(matches));
              }}
            />
          </div>
        );

      case "short-answer":
      case "extended":
        return (
          <div className="space-y-4">
            <div className="text-lg font-medium">{question.prompt}</div>
            <textarea
              className="w-full min-h-[200px] p-3 border rounded-md font-mono text-sm"
              placeholder="Type your answer here..."
              value={userAnswers[question.id] || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            />
          </div>
        );

      case "code":
        if (question.codeLanguage === "python") {
          return (
            <div className="space-y-4">
              <div className="text-lg font-medium mb-4">{question.prompt}</div>
              <PythonEditor
                initialCode={question.codeStarter || ""}
                expectedOutput={question.expectedOutput}
                onCodeChange={(code) => handleAnswerChange(question.id, code)}
              />
            </div>
          );
        }
        if (question.codeLanguage === "sql") {
          return (
            <div className="space-y-4">
              <div className="text-lg font-medium mb-4">{question.prompt}</div>
              <SQLEditor
                initialQuery={question.codeStarter || ""}
                sampleData={question.sqlSampleData}
                expectedOutput={question.expectedOutput}
                onQueryChange={(query) => handleAnswerChange(question.id, query)}
              />
            </div>
          );
        }
        if (question.codeLanguage === "diagram") {
          return (
            <div className="space-y-4">
              <div className="text-lg font-medium mb-4">{question.prompt}</div>
              <DiagramCanvas
                diagramType={question.prompt.includes("structure") ? "Structure Chart" :
                            question.prompt.includes("data flow") ? "Data Flow Diagram" :
                            question.prompt.includes("class") ? "Class Diagram" : "Decision Tree"}
                expectedOutput={question.expectedOutput}
                initialShapes={userAnswers[question.id]}
                onDiagramChange={(shapesData) => handleAnswerChange(question.id, shapesData)}
              />
            </div>
          );
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <RequireAuth>
      <AnimatePresence mode="wait">
        {markedAttempt ? (
          <motion.div
            key="marked-attempt"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-x-hidden"
          >
            {/* Results Header */}
            {(() => {
              // Calculate adjusted total including self-marked diagram scores
              const diagramMarks = markedAttempt.marks.filter(m => {
                const q = markedAttempt.questions.find(q => q.id === m.questionId);
                return q?.codeLanguage === "diagram";
              });

              const selfMarkedTotal = diagramMarks.reduce((sum, m) => {
                return sum + (selfMarkedScores[m.questionId] ?? 0);
              }, 0);

              const nonDiagramTotal = markedAttempt.marks
                .filter(m => {
                  const q = markedAttempt.questions.find(q => q.id === m.questionId);
                  return q?.codeLanguage !== "diagram";
                })
                .reduce((sum, m) => sum + m.totalMarks, 0);

              const adjustedTotal = nonDiagramTotal + selfMarkedTotal;
              const adjustedPercentage = markedAttempt.totalPossible > 0
                ? Math.round((adjustedTotal / markedAttempt.totalPossible) * 100)
                : 0;

              return (
                <Card className="border-primary/10 bg-gradient-to-br from-green-400/20 via-emerald-200/20 to-teal-600/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Award className="h-6 w-6 text-primary" />
                          <CardTitle className="text-2xl">Exam Results</CardTitle>
                        </div>
                        <CardDescription>{markedAttempt.examTitle}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-primary">
                          {adjustedPercentage}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {adjustedTotal} / {markedAttempt.totalPossible} marks
                        </div>
                        {selfMarkedTotal > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            (Includes {selfMarkedTotal} self-marked)
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleRetakeExam}
                        disabled={isMarking}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Retake Exam
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleRemarkExam()}
                        disabled={isMarking}
                      >
                        {isMarking ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Remark Exam
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMarkedAttempt(null);
                          setExam(null);
                          setExamRecordId(null);
                          setUserAnswers({});
                          setFlaggedQuestions([]);
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        New Exam
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Question-by-question results */}
            {markedAttempt.marks.map((mark) => {
              const question = markedAttempt.questions.find(q => q.id === mark.questionId);
              if (!question) return null;

              // For diagram questions, use self-marked score if available
              const isDiagram = question.codeLanguage === "diagram";
              const displayScore = isDiagram && selfMarkedScores[mark.questionId] !== undefined
                ? selfMarkedScores[mark.questionId]
                : mark.totalMarks;

              const isCorrect = displayScore === mark.maxMarks;
              const isPartial = displayScore > 0 && displayScore < mark.maxMarks;

              return (
                <Card key={mark.questionId} className={cn(
                  "transition border-2 overflow-x-hidden",
                  isCorrect && "border-green-500",
                  isPartial && "border-amber-500",
                  !isCorrect && !isPartial && mark.userAnswer && "border-red-500",
                  !mark.userAnswer && "border-muted"
                )}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                          ) : displayScore > 0 ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                          )}
                          <CardTitle className="text-lg">
                            Question {mark.questionNumber}
                          </CardTitle>
                          <Badge variant="outline">{question.type.toUpperCase()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">{question.prompt}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={cn(
                          "text-2xl font-bold",
                          isCorrect && "text-green-600",
                          isPartial && "text-amber-600",
                          !isCorrect && !isPartial && "text-red-600"
                        )}>
                          {displayScore} / {mark.maxMarks}
                        </div>
                        <div className="text-xs text-muted-foreground">marks</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 overflow-hidden">
                    {/* Your Answer - hide for matching questions (shown below with visual feedback) */}
                    {mark.userAnswer && question.type !== "matching" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Your Answer:</Label>
                        <div className="p-3 bg-background rounded-md border max-w-full">
                          {question.type === "code" ? (
                            <pre className="text-sm whitespace-pre-wrap font-mono break-words max-w-full overflow-hidden" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                              {mark.userAnswer}
                            </pre>
                          ) : question.codeLanguage === "diagram" ? (
                            <p className="text-sm text-muted-foreground italic">
                              Diagram submitted (technical drawing data)
                            </p>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words max-w-full" style={{ wordBreak: "break-word" }}>{mark.userAnswer}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {!mark.userAnswer && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm text-muted-foreground italic">Not attempted</p>
                      </div>
                    )}

                    {/* Matching: Visual feedback with color coding */}
                    {question.type === "matching" && mark.matchResults && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Matching Results:</Label>
                        <div className="space-y-3">
                          {mark.matchResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "p-4 rounded-md border-2 max-w-full overflow-hidden",
                                result.isCorrect
                                  ? "bg-green-50 dark:bg-green-950 border-green-500"
                                  : "bg-red-50 dark:bg-red-950 border-red-500"
                              )}
                            >
                              <div className="flex items-start gap-3 mb-2">
                                {result.isCorrect ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-semibold text-sm break-words">{result.left}</span>
                                    <span className="text-muted-foreground">→</span>
                                    {result.userRight ? (
                                      <span className={cn(
                                        "text-sm break-words",
                                        result.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                      )}>
                                        {result.userRight}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground italic">Not matched</span>
                                    )}
                                  </div>
                                  {!result.isCorrect && result.correctRight && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Correct answer: <span className="font-medium text-green-700 dark:text-green-400">{result.correctRight}</span>
                                    </div>
                                  )}
                                  {result.feedback && (
                                    <p className="text-xs text-muted-foreground mt-2 break-words" style={{ wordBreak: "break-word" }}>
                                      {result.feedback}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {mark.feedback && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/10 max-w-full">
                            <p className="text-sm break-words" style={{ wordBreak: "break-word" }}>{mark.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MCQ: All Options with Explanations */}
                    {question.type === "mcq" && mark.correctAnswer && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Answer Breakdown:</Label>
                        <div className="space-y-2">
                          {question.options?.map((option) => {
                            const isCorrect = option.label === mark.correctAnswer;
                            const isUserChoice = option.label === mark.userAnswer;
                            const explanationData = typeof mark.explanation === 'object' ? mark.explanation as Record<string, string> : {};
                            const optionExplanation = explanationData[option.label] || "";

                            return (
                              <div
                                key={option.label}
                                className={cn(
                                  "p-3 rounded-md border-2 max-w-full overflow-hidden",
                                  isCorrect && "bg-green-50 dark:bg-green-950 border-green-500",
                                  !isCorrect && "border-gray-200 dark:border-gray-800"
                                )}
                              >
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="font-semibold text-sm flex-shrink-0">{option.label}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm break-words">{option.value}</p>
                                  </div>
                                  {isUserChoice && (
                                    <Badge variant="outline" className="flex-shrink-0">Your choice</Badge>
                                  )}
                                  {isCorrect && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                {optionExplanation && (
                                  <p className="text-xs text-muted-foreground mt-2 break-words" style={{ wordBreak: "break-word" }}>
                                    {optionExplanation}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {mark.feedback && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/10 max-w-full">
                            <p className="text-sm break-words" style={{ wordBreak: "break-word" }}>{mark.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Written: Model Answer */}
                    {(question.type === "short-answer" || question.type === "extended") && mark.modelAnswer && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Model Answer:</Label>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md max-w-full">
                          <p className="text-sm whitespace-pre-wrap break-words max-w-full overflow-hidden" style={{ wordBreak: "break-word" }}>{mark.modelAnswer}</p>
                        </div>
                      </div>
                    )}

                    {/* Code: Example Code */}
                    {question.type === "code" && mark.exampleCode && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Example Solution:</Label>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md max-w-full">
                          <pre className="text-sm whitespace-pre-wrap font-mono break-words max-w-full overflow-hidden" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {mark.exampleCode}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Diagram: Description and Self-Marking */}
                    {question.codeLanguage === "diagram" && mark.diagramDescription && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Ideal Diagram Description:</Label>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md max-w-full">
                            <p className="text-sm whitespace-pre-wrap break-words max-w-full overflow-hidden" style={{ wordBreak: "break-word" }}>{mark.diagramDescription}</p>
                          </div>
                        </div>

                        {/* Self-Marking Input */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-950 border-2 border-amber-500 rounded-md space-y-2">
                          <Label htmlFor={`self-mark-${mark.questionId}`} className="text-sm font-semibold flex items-center gap-2">
                            <span>Self-Mark Your Diagram</span>
                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900">Required</Badge>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Compare your diagram to the description above and assign yourself a mark out of {mark.maxMarks}.
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Input
                              id={`self-mark-${mark.questionId}`}
                              type="number"
                              min={0}
                              max={mark.maxMarks}
                              step={0.5}
                              value={selfMarkedScores[mark.questionId] ?? ""}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0 && value <= mark.maxMarks) {
                                  setSelfMarkedScores(prev => ({ ...prev, [mark.questionId]: value }));
                                }
                              }}
                              className="w-24"
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground">/ {mark.maxMarks} marks</span>
                          </div>
                          {selfMarkedScores[mark.questionId] !== undefined && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              ✓ You awarded yourself {selfMarkedScores[mark.questionId]} / {mark.maxMarks} marks
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mark Breakdown */}
                    {mark.markBreakdown && mark.markBreakdown.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Mark Breakdown:</Label>
                        <div className="space-y-2">
                          {mark.markBreakdown.map((criterion, criterionIdx) => (
                            <div key={criterionIdx} className="p-3 bg-background rounded-md border max-w-full overflow-hidden">
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <span className="text-sm font-medium break-words flex-1 max-w-full" style={{ wordBreak: "break-word" }}>{criterion.criterion}</span>
                                <span className="text-sm font-semibold flex-shrink-0 whitespace-nowrap">
                                  {criterion.marksAwarded} / {criterion.maxMarks}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground break-words max-w-full" style={{ wordBreak: "break-word" }}>{criterion.feedback}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overall Feedback */}
                    {mark.feedback && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Feedback:</Label>
                        <div className="p-3 bg-primary/5 rounded-md border border-primary/10 max-w-full">
                          <p className="text-sm whitespace-pre-wrap break-words max-w-full overflow-hidden" style={{ wordBreak: "break-word" }}>{mark.feedback}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        ) : !exam ? (
          <motion.div
            key="exam-setup"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <Card className="border-primary/10 bg-gradient-to-br from-violet-400/20 via-fuchsia-200/20 to-pink-600/20">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl font-semibold">NESA Software Engineering Exam</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Generate realistic NSW HSC practice exams with interactive Python, SQL, and diagram questions.
                </CardDescription>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">4 HSC Modules</Badge>
                  <Badge variant="outline">Interactive Code Editor</Badge>
                  <Badge variant="outline">SQL & Diagram Questions</Badge>
                </div>
              </CardHeader>
            </Card>

            {(loadingExams || savedExams.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Saved Exams
                  </CardTitle>
                  <CardDescription>
                    All community generated exams. Only you see your attempt history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loadingExams ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : savedExams.length > 0 ? (
                      savedExams.map((savedExam, index) => {
                        const examData = savedExam.output as NESAExam;

                        const displayName = savedExam.label?.trim() || examData.examTitle;
                        const totalMarks = examData.totalMarks;
                        const questionCount = examData.questions?.length || 0;

                        // Check if user has a marked attempt for this exam (match by exam record ID)
                        const userAttempt = userAttempts.find(attempt => {
                          const attemptData = attempt.output as NESAMarkedAttempt & { examRecordId?: string };
                          return attemptData.examRecordId === savedExam.id;
                        });

                        // Calculate adjusted percentage including self-marked diagram scores
                        let adjustedPercentage = 0;
                        if (userAttempt) {
                          const attemptData = userAttempt.output as NESAMarkedAttempt;
                          const diagramMarks = attemptData.marks.filter(m => {
                            const q = attemptData.questions.find(q => q.id === m.questionId);
                            return q?.codeLanguage === "diagram";
                          });

                          const selfMarkedTotal = diagramMarks.reduce((sum, m) => {
                            return sum + (m.selfMarkedScore ?? 0);
                          }, 0);

                          const nonDiagramTotal = attemptData.marks
                            .filter(m => {
                              const q = attemptData.questions.find(q => q.id === m.questionId);
                              return q?.codeLanguage !== "diagram";
                            })
                            .reduce((sum, m) => sum + m.totalMarks, 0);

                          const adjustedTotal = nonDiagramTotal + selfMarkedTotal;
                          adjustedPercentage = attemptData.totalPossible > 0
                            ? Math.round((adjustedTotal / attemptData.totalPossible) * 100)
                            : attemptData.percentage;
                        }

                        // Check if user has in-progress data for this exam (match by exam record ID)
                        const progressData = userProgress.find(progress => {
                          const progressOutput = progress.output as { examId?: string };
                          return progressOutput.examId === savedExam.id;
                        });

                        const isEditing = editingExamId === savedExam.id;
                        return (
                          <motion.div
                            key={savedExam.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="rounded-lg border p-4 transition hover:bg-muted/50"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex-1 space-y-2">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Label htmlFor={`rename-${savedExam.id}`} className="text-sm font-medium">
                                      New shared name
                                    </Label>
                                    <Input
                                      id={`rename-${savedExam.id}`}
                                      value={editingLabel}
                                      onChange={(event) => setEditingLabel(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void handleRenameExam();
                                        }
                                      }}
                                      placeholder="e.g., Mock Exam – Databases Focus"
                                      autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Everyone can see this name in the shared exams list.
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="font-medium">{displayName}</h3>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(savedExam.createdAt), "MMM d, yyyy")}
                                      </span>
                                      <span>{totalMarks} marks</span>
                                      <span>{questionCount} questions</span>
                                      {userAttempt && (
                                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                                          Completed ({adjustedPercentage}%)
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Generated by{" "}
                                      <span className="font-medium text-foreground">{savedExam.createdByName ?? "Focusly Learner"}</span>
                                    </p>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => void handleRenameExam()}
                                      disabled={renameLoading}
                                    >
                                      {renameLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelRenaming}
                                      disabled={renameLoading}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {userAttempt ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewAttempt(userAttempt)}
                                      >
                                        View Results
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleContinueExam(savedExam, progressData)}
                                      >
                                        {progressData ? "Continue" : "Start"}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startRenamingExam(savedExam)}
                                    >
                                      <Pencil className="mr-1 h-4 w-4" />
                                      Rename
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteExam(savedExam.id)}
                                      title={
                                        isEzraUser
                                          ? undefined
                                          : "Only Focusly administrator Ezra can delete shared exams."
                                      }
                                    >
                                      <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        You haven&rsquo;t saved any Software Engineering exams yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Generate Exam</CardTitle>
                <CardDescription>
                  Configure your practice exam settings below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-3">
                    <Label>Select Modules to Include</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {NESA_MODULES.map((module) => (
                        <label
                          key={module}
                          className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedModules?.includes(module)}
                            onCheckedChange={() => toggleModule(module)}
                          />
                          <span>{module}</span>
                        </label>
                      ))}
                    </div>
                    {errors.modules && (
                      <p className="text-sm text-destructive">{errors.modules.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="questionCount">Number of Questions (15-30)</Label>
                    <Input
                      id="questionCount"
                      type="number"
                      min={15}
                      max={30}
                      {...register("questionCount", { valueAsNumber: true })}
                    />
                    {errors.questionCount && (
                      <p className="text-sm text-destructive">{errors.questionCount.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seed">Seed (optional, for deterministic generation)</Label>
                    <Input
                      id="seed"
                      placeholder="e.g., exam-2024-practice-1"
                      {...register("seed")}
                    />
                  </div>

                  <Button type="submit" disabled={generating} className="w-full">
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Exam... can take up to 120 seconds
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Exam
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="exam-session"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{exam.examTitle}</CardTitle>
                    <CardDescription>
                      Total Marks: {exam.totalMarks} | Time Allowed: {exam.timeAllowed} minutes
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={exportExamAsJSON}>
                      <Download className="mr-2 h-4 w-4" />
                      Export JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExam(null);
                        setExamRecordId(null);
                        setCurrentQuestionIndex(0);
                        setUserAnswers({});
                        setFlaggedQuestions([]);
                      }}
                    >
                      New Exam
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h3 className="font-semibold">Instructions:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {exam.instructions.map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <AnimatePresence mode="wait">
              {currentQuestion && (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex flex-wrap items-center gap-3">
                            Question {currentQuestion.questionNumber}
                            <Badge>
                              {currentQuestion.marks} {currentQuestion.marks === 1 ? "mark" : "marks"}
                            </Badge>
                            <Badge variant="outline">{currentQuestion.type.toUpperCase()}</Badge>
                            {isCurrentQuestionFlagged && (
                              <Badge className="border-amber-400 bg-amber-100 text-amber-900">
                                Flagged
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {currentQuestion.modules.join(", ")}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                          <div>
                            {currentQuestionIndex + 1} / {exam.questions.length}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleFlag(currentQuestion.id)}
                            className={cn(
                              "gap-2",
                              isCurrentQuestionFlagged && "border-amber-500 bg-amber-50 text-amber-900"
                            )}
                          >
                            <Flag className="h-4 w-4" />
                            {isCurrentQuestionFlagged ? "Unflag" : "Flag"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {renderQuestion(currentQuestion)}

                      <div className="flex justify-between pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentQuestionIndex === 0}
                        >
                          <ChevronLeft className="mr-2 h-4 w-4" />
                          Previous
                        </Button>
                        {currentQuestionIndex === exam.questions.length - 1 ? (
                          <Button onClick={handleFinishExam}>
                            Finish
                            <Flag className="ml-2 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            onClick={() =>
                              setCurrentQuestionIndex((prev) =>
                                Math.min(exam.questions.length - 1, prev + 1)
                              )
                            }
                          >
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card>
              <CardHeader>
                <CardTitle>Question Navigator</CardTitle>
                <CardDescription>
                  Green borders show answered questions. Amber highlights indicate flagged questions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {exam.questions.map((q, idx) => {
                    const isFlagged = flaggedQuestions.includes(q.id);
                    return (
                      <Button
                        key={q.id}
                        variant={idx === currentQuestionIndex ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={cn(
                          "gap-2",
                          userAnswers[q.id] && "border-green-500",
                          isFlagged && "border-amber-500 bg-amber-50 text-amber-900"
                        )}
                      >
                        {isFlagged && <Flag className="h-3 w-3" />}
                        Q{q.questionNumber}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deletion restricted</DialogTitle>
            <DialogDescription>
              {adminDialogMessage ||
                "Only Focusly administrator Ezra can delete shared exams. Everyone keeps access to generated exams."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-end">
            <Button onClick={() => setAdminDialogOpen(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finishDialogOpen || isMarking} onOpenChange={(open) => !isMarking && setFinishDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isMarking ? "Marking Your Exam" : "Finish Exam"}</DialogTitle>
            <DialogDescription>
              {isMarking
                ? "AI is reviewing your answers and providing detailed feedback. This may take a minute..."
                : "Your attempt has been saved. Would you like AI to mark your exam and provide detailed feedback?"}
            </DialogDescription>
          </DialogHeader>
          {isMarking ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing {exam?.questions.length || markedAttempt?.questions.length || 0} questions...
              </p>
            </div>
          ) : (
            <>
              <div className="py-4 space-y-3">
                <p className="text-sm">
                  AI marking will provide:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground ml-2">
                  <li>Correct answers and explanations for MCQs</li>
                  <li>Model answers and mark breakdown for written responses</li>
                  <li>Example code and mark breakdown for programming questions</li>
                  <li>Self-marking guidance for diagram questions</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  Answered: {Object.keys(userAnswers).length} / {exam?.questions.length || 0} questions
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFinishDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRequestMarking} disabled={isMarking}>
                  Get AI Marking
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </RequireAuth>
  );
}
