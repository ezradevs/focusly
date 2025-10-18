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
} from "lucide-react";
import { toast } from "sonner";
import { focuslyApi } from "@/lib/api";
import type { NESAExam, NESAQuestion, NESAModuleName, ModuleOutputRecord } from "@/types";
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
  includeMarkingGuide: z.boolean(),
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [savedExams, setSavedExams] = useState<ModuleOutputRecord[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [flaggedQuestions, setFlaggedQuestions] = useState<string[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminDialogMessage, setAdminDialogMessage] = useState("");
  const currentUser = useAuthStore((state) => state.user);
  const isEzraUser =
    currentUser?.name?.trim().toLowerCase() === "ezra" ||
    currentUser?.email?.split("@")[0]?.toLowerCase() === "ezra";

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
      includeMarkingGuide: false,
      seed: "",
    },
  });

  const selectedModules = watch("modules");

  useEffect(() => {
    const loadExams = async () => {
      try {
        const { exams } = await focuslyApi.getNESAExams();
        setSavedExams(exams);
      } catch (error) {
      } finally {
        setLoadingExams(false);
      }
    };

    loadExams();
  }, []);

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
        includeMarkingGuide: data.includeMarkingGuide,
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
      setSavedExams(exams);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate exam";
      toast.error(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleContinueExam = (savedExam: ModuleOutputRecord) => {
    const examData = savedExam.output as NESAExam;
    setExam(examData);
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
      setSavedExams((prev) =>
        prev.map((record) => (record.id === editingExamId ? { ...record, ...updatedExam } : record))
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
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition"
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.label}
                    checked={userAnswers[question.id] === option.label}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="mt-1"
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
                onDiagramChange={(imageData) => handleAnswerChange(question.id, imageData)}
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
        {!exam ? (
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
                    Rename shared exams for clarity. Only Ezra can delete them for the community.
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
                                      <span>{examData.totalMarks} marks</span>
                                      <span>{examData.questions.length} questions</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Generated by <span className="font-medium text-foreground">{savedExam.createdByName ?? "Focusly Learner"}</span>
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
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleContinueExam(savedExam)}
                                    >
                                      Continue
                                    </Button>
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

                  <label className="flex items-center gap-3">
                    <Checkbox {...register("includeMarkingGuide")} />
                    <span className="text-sm">Include marking guide with answers</span>
                  </label>

                  <Button type="submit" disabled={generating} className="w-full">
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Exam...
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
                        <Button
                          onClick={() =>
                            setCurrentQuestionIndex((prev) =>
                              Math.min(exam.questions.length - 1, prev + 1)
                            )
                          }
                          disabled={currentQuestionIndex === exam.questions.length - 1}
                        >
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
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
    </RequireAuth>
  );
}
