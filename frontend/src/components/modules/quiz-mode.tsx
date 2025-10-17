"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  FolderOpen,
  GraduationCap,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GeneratedQuestion, QuizAttempt, ModuleOutputRecord } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useQuizStore } from "@/store/quiz";
import { focuslyApi } from "@/lib/api";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn, formatQuestionType, formatSubject } from "@/lib/utils";

interface DraftState {
  [questionId: string]: string;
}

export function QuizModeModule() {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    stagedQuestions,
    createSession,
    recordAttempt,
    completeSession,
    resetSession,
  } = useQuizStore();

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch saved question sets
  const { data: savedOutputsData, isLoading: isLoadingSaved } = useQuery({
    queryKey: ["outputs", "QUESTION_SET"],
    queryFn: () => focuslyApi.listOutputs({ module: "QUESTION_SET", limit: 50 }),
    enabled: showLoadDialog,
  });

  const currentQuestion =
    activeSession?.questions[currentIndex] ?? activeSession?.questions.at(-1);

  const attemptsMap = useMemo(() => {
    const map = new Map<string, QuizAttempt>();
    if (!activeSession) return map;
    for (const attempt of activeSession.attempts) {
      map.set(attempt.questionId, attempt);
    }
    return map;
  }, [activeSession]);

  const startFromStaged = () => {
    if (!stagedQuestions.length) {
      toast.info("No staged questions yet", {
        description:
          "Generate a question set first, then send it to Quiz Mode.",
      });
      return;
    }
    const session = createSession(stagedQuestions);
    setActiveSession(session.id);
    setCurrentIndex(0);
    setDrafts({});
    toast.success("Quiz session ready");
  };

  const loadFromSaved = (output: ModuleOutputRecord) => {
    try {
      const data = output.output as { questions: GeneratedQuestion[] };
      if (!data.questions || !Array.isArray(data.questions)) {
        toast.error("Invalid question set format");
        return;
      }
      const session = createSession(data.questions);
      setActiveSession(session.id);
      setCurrentIndex(0);
      setDrafts({});
      setShowLoadDialog(false);
      toast.success(`Loaded ${data.questions.length} questions`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load question set");
    }
  };

  const resetCurrentSession = () => {
    if (!activeSession) return;
    resetSession(activeSession.id);
    setDrafts({});
    setCurrentIndex(0);
    toast.success("Session reset", {
      description: "All attempts cleared. Ready to start fresh!",
    });
  };

  const handleSelectOption = (questionId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [questionId]: value }));
  };

  const determineCorrect = (
    question: GeneratedQuestion,
    userAnswer: string
  ) => {
    const correct = question.answer.trim().toLowerCase();
    const answer = userAnswer.trim().toLowerCase();
    if (correct === answer) return true;
    const matchingOption = question.options?.find(
      (option) => option.label.toLowerCase() === answer
    );
    if (matchingOption) {
      const expectedOption = question.options?.find((option) =>
        option.label
          .trim()
          .toLowerCase()
          .includes(correct.toLowerCase())
      );
      if (expectedOption && expectedOption.label === matchingOption.label) {
        return true;
      }
    }
    const optionByLabel = question.options?.find(
      (option) => option.label.toLowerCase() === correct
    );
    if (optionByLabel && optionByLabel.label.toLowerCase() === answer) {
      return true;
    }
    const optionByValue = question.options?.find(
      (option) => option.value.trim().toLowerCase() === userAnswer.trim().toLowerCase()
    );
    if (optionByValue) {
      return (
        optionByValue.value.trim().toLowerCase() ===
        question.answer.trim().toLowerCase()
      );
    }
    return false;
  };

  const submitCurrent = useCallback(async () => {
    if (!activeSession || !currentQuestion) return;
    const draftAnswer = drafts[currentQuestion.id];
    if (!draftAnswer) {
      toast.info("Enter an answer first", {
        description: "Type your response, or select an option before submitting.",
      });
      return;
    }
    if (attemptsMap.has(currentQuestion.id)) {
      toast.info("Already marked", {
        description: "Move to the next question or review the feedback below.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentQuestion.type === "mcq") {
        const isCorrect = determineCorrect(currentQuestion, draftAnswer);
        recordAttempt(activeSession.id, {
          questionId: currentQuestion.id,
          userAnswer: draftAnswer,
          isCorrect,
          feedback: isCorrect
            ? "Correct! Nicely reasoned."
            : `Review the model answer: ${currentQuestion.answer}`,
          improvementTips: isCorrect
            ? []
            : [currentQuestion.explanation ?? "Check the explanation above."],
          timestamp: Date.now(),
        });
        toast[isCorrect ? "success" : "error"](
          isCorrect ? "Correct response" : "Not quite right"
        );
      } else {
        const feedback = await focuslyApi.getQuizFeedback({
          questionId: currentQuestion.id,
          questionPrompt: currentQuestion.prompt,
          questionType: currentQuestion.type,
          userAnswer: draftAnswer,
          correctAnswer: currentQuestion.answer,
          context: currentQuestion.explanation,
        });
        recordAttempt(activeSession.id, {
          questionId: currentQuestion.id,
          userAnswer: draftAnswer,
          isCorrect: feedback.isCorrect,
          feedback: feedback.feedback,
          improvementTips: feedback.improvementTips,
          timestamp: Date.now(),
        });
        void queryClient.invalidateQueries({ queryKey: ["outputs"] });
        toast[feedback.isCorrect ? "success" : "warning"]("Feedback received");
      }

      const totalAnswered = activeSession.attempts.length + 1;
      if (totalAnswered === activeSession.questions.length) {
        const correct =
          activeSession.attempts.filter((item) => item.isCorrect).length + 1;
        const score = Math.round(
          (correct / activeSession.questions.length) * 100
        );
        completeSession(activeSession.id, score);
        toast.success("Quiz complete!", {
          description: `Final score: ${score}%`,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Unable to submit answer."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeSession,
    attemptsMap,
    completeSession,
    currentQuestion,
    queryClient,
    drafts,
    recordAttempt,
  ]);

  const progress = activeSession
    ? (activeSession.attempts.length / activeSession.questions.length) * 100
    : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeSession || !currentQuestion) return;

      // Don't trigger shortcuts if user is typing in a textarea
      if (event.target instanceof HTMLTextAreaElement) return;

      // Enter to submit (only if not already submitted)
      if (event.key === "Enter" && !attemptsMap.has(currentQuestion.id)) {
        event.preventDefault();
        void submitCurrent();
      }

      // Arrow left/right for navigation
      if (event.key === "ArrowLeft" && currentIndex > 0) {
        event.preventDefault();
        setCurrentIndex((index) => Math.max(0, index - 1));
      }

      if (
        event.key === "ArrowRight" &&
        currentIndex < activeSession.questions.length - 1
      ) {
        event.preventDefault();
        setCurrentIndex((index) =>
          Math.min(activeSession.questions.length - 1, index + 1)
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSession, currentQuestion, currentIndex, attemptsMap, submitCurrent]);

  return (
    <RequireAuth>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <Card className="border-primary/15 bg-gradient-to-br from-indigo-500/15 via-transparent to-purple-600/15 lg:col-span-2">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-semibold">Quiz Mode</CardTitle>
            </div>
            <CardDescription className="text-base">
              Turn generated questions into live drill sessions with adaptive feedback, attempt history, and mastery tracking.
            </CardDescription>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Stage sets from Question Generator</Badge>
              <Badge variant="outline">Instant marking + feedback</Badge>
              <Badge variant="outline">Performance analytics</Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  <CardTitle className="text-xl font-semibold">Quiz Mode</CardTitle>
                </div>
                <CardDescription>
                  Run through your generated questions with instant AI feedback and analytics.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingHistory((prev) => !prev)}>
                  <History className="mr-2 h-4 w-4" />
                  {viewingHistory ? "Hide history" : "Show history"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowLoadDialog(true)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Load saved
                </Button>
                <Button variant="secondary" size="sm" onClick={startFromStaged} disabled={!stagedQuestions.length}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Load staged
                </Button>
                <Button variant="ghost" size="icon" onClick={resetCurrentSession} disabled={!activeSession}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Progress value={progress} className="h-2 flex-1" />
                  <Badge variant="outline">{Math.round(progress)}% complete</Badge>
                </div>
                {activeSession && activeSession.attempts.length > 0 && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {activeSession.attempts.filter((attempt) => attempt.isCorrect).length} correct
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-red-600" />
                      {activeSession.attempts.filter((attempt) => !attempt.isCorrect).length} incorrect
                    </span>
                  </div>
                )}
              </div>
              {activeSession ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Session created {new Date(activeSession.createdAt).toLocaleString()} · {activeSession.questions.length} questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeSession.questions.map((question, index) => {
                      const isAnswered = attemptsMap.has(question.id);
                      const isCurrent = index === currentIndex;
                      const attempt = attemptsMap.get(question.id);
                      return (
                        <button
                          key={question.id}
                          onClick={() => setCurrentIndex(index)}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold transition",
                            isCurrent && "ring-2 ring-primary ring-offset-2",
                            isAnswered && attempt?.isCorrect && "bg-green-500 text-white hover:bg-green-600",
                            isAnswered && !attempt?.isCorrect && "bg-red-500 text-white hover:bg-red-600",
                            !isAnswered && "border bg-background hover:bg-muted"
                          )}
                          title={`Question ${index + 1}${isAnswered ? (attempt?.isCorrect ? " - Correct" : " - Incorrect") : ""}`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate questions and send them here to start a quiz.
                </p>
              )}
            </CardContent>
          </Card>

          {activeSession && currentQuestion ? (
            <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span>
                  Question {currentIndex + 1} of {activeSession.questions.length}
                </span>
                <Badge variant="secondary">
                  {formatQuestionType(currentQuestion.type)}
                </Badge>
              </div>
              <CardTitle className="text-lg">{currentQuestion.prompt}</CardTitle>
              <CardDescription>
                {currentQuestion.type === "mcq"
                  ? "Select the best option before submitting."
                  : "Craft your best possible answer. You'll receive specific feedback."}
                {!attemptsMap.has(currentQuestion.id) && (
                  <span className="mt-1 block text-xs">
                    Tip: Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Enter</kbd> to submit, <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">←</kbd> <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">→</kbd> to navigate
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentQuestion.type === "mcq" ? (
                <div className="grid gap-3">
                  {currentQuestion.options?.map((option) => {
                    const isSelected =
                      drafts[currentQuestion.id] === option.label;
                    const attempt = attemptsMap.get(currentQuestion.id);
                    const isCorrectOption =
                      attempt?.isCorrect &&
                      option.label
                        .trim()
                        .toLowerCase() ===
                        currentQuestion.answer.trim().toLowerCase();

                    return (
                      <button
                        key={option.label}
                        onClick={() =>
                          handleSelectOption(currentQuestion.id, option.label)
                        }
                        className={cnOptionButton(
                          isSelected,
                          Boolean(attempt),
                          Boolean(isCorrectOption)
                        )}
                        disabled={Boolean(attempt)}
                      >
                        <div className="flex items-start gap-3 text-left">
                          <span className="mt-1 text-sm font-semibold">
                            {option.label}.
                          </span>
                          <span className="text-sm leading-relaxed">
                            {option.value}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Textarea
                  rows={8}
                  placeholder="Type your response..."
                  value={drafts[currentQuestion.id] ?? ""}
                  onChange={(event) =>
                    handleSelectOption(
                      currentQuestion.id,
                      event.target.value.slice(0, 2000)
                    )
                  }
                  disabled={attemptsMap.has(currentQuestion.id)}
                />
              )}

              {attemptsMap.has(currentQuestion.id) && (
                <FeedbackPanel
                  correctAnswer={currentQuestion.answer}
                  explanation={currentQuestion.explanation}
                  attempt={attemptsMap.get(currentQuestion.id)!}
                />
              )}

              <div className="flex flex-wrap justify-between gap-3">
                {!attemptsMap.has(currentQuestion.id) ? (
                  <Button
                    type="button"
                    onClick={submitCurrent}
                    disabled={isSubmitting}
                    className="min-w-[140px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Submit answer
                      </>
                    )}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentIndex((index) => Math.max(0, index - 1));
                    }}
                    disabled={currentIndex === 0}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentIndex((index) =>
                        Math.min(activeSession.questions.length - 1, index + 1)
                      );
                    }}
                    disabled={currentIndex === activeSession.questions.length - 1}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AwaitingSession stagedCount={stagedQuestions.length} />
        )}
        </div>

      <aside className="space-y-6">
        {viewingHistory && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-muted-foreground" />
                Past sessions
              </CardTitle>
              <CardDescription>
                Revisit previous quiz runs and review detailed feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length ? (
                <ScrollArea className="h-[460px] pr-3">
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="rounded-lg border bg-muted/40 p-4 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {new Date(session.createdAt).toLocaleDateString()}{" "}
                              {new Date(session.createdAt).toLocaleTimeString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.questions.length} questions
                            </p>
                          </div>
                          {session.score !== undefined && (
                            <Badge
                              variant={
                                (session.score ?? 0) >= 80
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              Score {session.score}%
                            </Badge>
                          )}
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          {session.attempts.map((attempt) => {
                            const question = session.questions.find(
                              (item) => item.id === attempt.questionId
                            );
                            if (!question) return null;
                            return (
                              <div
                                key={attempt.questionId}
                                className="rounded-md border bg-background p-3"
                              >
                                <p className="text-sm font-medium">
                                  {question.prompt}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatQuestionType(question.type)}
                                </p>
                                <Separator className="my-2" />
                                <p className="text-sm">
                                  Your answer: {attempt.userAnswer}
                                </p>
                                <p className="text-sm">
                                  {attempt.isCorrect ? "Correct" : "Incorrect"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {attempt.feedback}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setActiveSession(session.id);
                            setCurrentIndex(0);
                            setViewingHistory(false);
                          }}
                        >
                          Resume session
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate and complete quizzes to build your performance log.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {activeSession?.analytics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Performance</span>
                <Target className="h-5 w-5 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <StatRow
                icon={<Award className="h-4 w-4 text-primary" />}
                label="Accuracy"
                value={`${Math.round(
                  (activeSession.analytics.accuracy ?? 0) * 100
                )}%`}
              />
              <StatRow
                icon={<Rocket className="h-4 w-4 text-primary" />}
                label="Questions attempted"
                value={activeSession.analytics.attempted.toString()}
              />
              <StatRow
                icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                label="Correct answers"
                value={activeSession.analytics.correct.toString()}
              />
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Load Saved Questions Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Saved Question Set</DialogTitle>
            <DialogDescription>
              Select a previously generated question set to start a new quiz session
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[500px] pr-4">
            {isLoadingSaved ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading saved question sets...
              </div>
            ) : savedOutputsData?.outputs && savedOutputsData.outputs.length > 0 ? (
              <div className="space-y-3">
                {savedOutputsData.outputs.map((output) => {
                  const data = output.output as { questions: GeneratedQuestion[] };
                  const questionCount = data.questions?.length ?? 0;
                  const types = new Set(data.questions?.map((q) => q.type) ?? []);

                  return (
                    <button
                      key={output.id}
                      onClick={() => loadFromSaved(output)}
                      className="w-full rounded-lg border bg-background p-4 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <p className="font-semibold">
                            {output.label || formatSubject(output.subject) || "Question Set"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{questionCount} questions</Badge>
                            {output.subject && (
                              <Badge variant="secondary">{formatSubject(output.subject)}</Badge>
                            )}
                            {Array.from(types).map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {formatQuestionType(type)}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(output.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 py-12 text-center">
                <Rocket className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-1">
                  <p className="font-medium">No saved question sets</p>
                  <p className="text-sm text-muted-foreground">
                    Generate questions first to see them here
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </motion.div>
    </RequireAuth>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function FeedbackPanel({
  attempt,
  correctAnswer,
  explanation,
}: {
  attempt: QuizAttempt;
  correctAnswer: string;
  explanation: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-primary">
        <ShieldCheck className="h-4 w-4" />
        {attempt.isCorrect ? "Marked correct" : "Marked incorrect"}
      </div>
      <p>{attempt.feedback}</p>
      {!attempt.isCorrect && (
        <div className="rounded-md bg-background/70 p-3">
          <p className="text-xs uppercase text-muted-foreground">
            Suggested improvements
          </p>
          <ul className="mt-2 space-y-1">
            {attempt.improvementTips.map((tip, index) => (
              <li key={index} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Separator />
      <div className="space-y-2">
        <p className="text-xs uppercase text-muted-foreground">
          Model answer
        </p>
        <MarkdownRenderer content={correctAnswer} />
        {explanation && (
          <>
            <Separator className="my-2" />
            <p className="text-xs uppercase text-muted-foreground">
              Explanation
            </p>
            <MarkdownRenderer content={explanation} />
          </>
        )}
      </div>
    </div>
  );
}

function AwaitingSession({ stagedCount }: { stagedCount: number }) {
  return (
    <Card className="flex h-full items-center justify-center border-dashed bg-muted/30">
      <CardContent className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
        <Rocket className="h-10 w-10 text-muted-foreground/60" />
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            No active quiz session yet.
          </p>
          <p>
            Generate questions and send them here, or load one of your previous
            sessions from history. {stagedCount > 0 && "You have a staged set ready to launch."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function cnOptionButton(
  selected: boolean,
  locked: boolean,
  isCorrectOption: boolean
) {
  return cn(
    "w-full rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary",
    selected && !locked
      ? "border-primary bg-primary/10"
      : "hover:border-primary/60 hover:bg-muted/60",
    locked &&
      selected &&
      (isCorrectOption
        ? "border-green-500/70 bg-green-500/10"
        : "border-destructive/70 bg-destructive/10")
  );
}
