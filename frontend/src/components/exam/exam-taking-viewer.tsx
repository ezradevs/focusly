"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  FileText,
  Flag,
  Pause,
  Play,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { toast } from "sonner";
import type { ExamSession, ExamAnswer } from "@/types";

interface ExamTakingViewerProps {
  session: ExamSession;
  onSaveAnswer: (answer: ExamAnswer) => void;
  onComplete: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
}

export function ExamTakingViewer({
  session,
  onSaveAnswer,
  onComplete,
  onPause,
  onResume,
  onClose,
}: ExamTakingViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [questionStartTime, setQuestionStartTime] = useState<Map<string, number>>(new Map());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const currentQuestion = session.questions[currentIndex];
  const progress = ((currentIndex + 1) / session.questions.length) * 100;

  // Initialize answers from session
  useEffect(() => {
    const answerMap = new Map<string, string>();
    const timeMap = new Map<string, number>();

    session.answers.forEach((answer) => {
      answerMap.set(answer.questionId, answer.answer);
    });

    session.questions.forEach((q) => {
      if (!timeMap.has(q.id!)) {
        timeMap.set(q.id!, Date.now());
      }
    });

    setAnswers(answerMap);
    setQuestionStartTime(timeMap);
  }, [session]);

  // Timer effect with tab visibility support
  useEffect(() => {
    if (session.isPaused) return;

    let interval: NodeJS.Timeout | null = null;

    const startInterval = () => {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    };

    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Handle visibility change - pause timer when tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        startInterval();
      }
    };

    // Start timer initially
    startInterval();

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session.isPaused]);

  // Track time when changing questions
  useEffect(() => {
    if (currentQuestion?.id && !questionStartTime.has(currentQuestion.id)) {
      setQuestionStartTime(new Map(questionStartTime.set(currentQuestion.id, Date.now())));
    }
  }, [currentIndex, currentQuestion]);

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion.id) return;
    setAnswers(new Map(answers.set(currentQuestion.id, value)));
  };

  const handleSaveCurrentAnswer = () => {
    if (!currentQuestion.id) return;

    const answer = answers.get(currentQuestion.id) || "";
    const startTime = questionStartTime.get(currentQuestion.id) || Date.now();
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    onSaveAnswer({
      questionId: currentQuestion.id,
      answer,
      timeSpentSeconds: timeSpent,
    });

    toast.success("Answer saved");
  };

  const handleNext = () => {
    handleSaveCurrentAnswer();
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    handleSaveCurrentAnswer();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleCompleteExam = () => {
    handleSaveCurrentAnswer();
    onComplete();
    toast.success("Exam submitted!");
  };

  const stats = useMemo(() => {
    const answered = Array.from(answers.values()).filter((a) => a.trim().length > 0).length;
    const unanswered = session.questions.length - answered;
    return { answered, unanswered };
  }, [answers, session.questions.length]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentQuestion) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No questions available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{session.examName}</h2>
          <p className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {session.questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{formatTime(elapsedSeconds)}</span>
          </div>
          {session.isPaused ? (
            <Button variant="outline" size="sm" onClick={onResume}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onPause}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-600" />
            <span>{stats.answered} answered</span>
          </div>
          <div className="flex items-center gap-1">
            <Flag className="h-3 w-3 text-amber-600" />
            <span>{stats.unanswered} remaining</span>
          </div>
        </div>
      </div>

      {/* Question Navigator */}
      <div className="flex flex-wrap gap-2">
        {session.questions.map((question, index) => (
          <button
            key={question.id || index}
            onClick={() => {
              handleSaveCurrentAnswer();
              setCurrentIndex(index);
            }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition",
              index === currentIndex && "border-primary bg-primary text-primary-foreground",
              index !== currentIndex &&
                answers.has(question.id!) &&
                answers.get(question.id!)!.trim().length > 0 &&
                "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20",
              index !== currentIndex &&
                (!answers.has(question.id!) || !answers.get(question.id!)!.trim()) &&
                "hover:border-primary/60"
            )}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Question Card */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <Card className="flex h-full flex-col p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Question {currentIndex + 1}</Badge>
                  {currentQuestion.timeAllocationMinutes && (
                    <Badge variant="outline">
                      <Clock className="mr-1 h-3 w-3" />
                      {currentQuestion.timeAllocationMinutes} min suggested
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Prompt</p>
                <MarkdownRenderer content={currentQuestion.prompt} />
              </div>

              {currentQuestion.criteria && currentQuestion.criteria.length > 0 && (
                <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Marking Criteria
                  </p>
                  <ul className="space-y-1">
                    {currentQuestion.criteria.map((criterion, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Your Answer
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleSaveCurrentAnswer}>
                    <Save className="mr-2 h-3 w-3" />
                    Save
                  </Button>
                </div>
                <Textarea
                  value={answers.get(currentQuestion.id!) || ""}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Type your answer here..."
                  className="min-h-[200px] resize-none font-mono text-sm"
                  disabled={session.isPaused}
                />
                <p className="text-xs text-muted-foreground">
                  {answers.get(currentQuestion.id!)?.length || 0} characters
                </p>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex === session.questions.length - 1}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <Button onClick={handleCompleteExam} size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Submit Exam
        </Button>
      </div>
    </div>
  );
}
