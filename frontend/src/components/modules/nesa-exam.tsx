"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ChevronLeft, ChevronRight, Download, Trash2, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { focuslyApi } from "@/lib/api";
import type { NESAExam, NESAQuestion, NESAModuleName, ModuleOutputRecord } from "@/types";
import { PythonEditor } from "@/components/nesa/python-editor";
import { SQLEditor } from "@/components/nesa/sql-editor";
import { DiagramCanvas } from "@/components/nesa/diagram-canvas";
import { format } from "date-fns";

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
        console.error("Failed to load exams:", error);
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
  };

  const handleDeleteExam = async (id: string) => {
    try {
      await focuslyApi.deleteNESAExam(id);
      setSavedExams((prev) => prev.filter((e) => e.id !== id));
      toast.success("Exam deleted");

      // If the currently active exam was deleted, clear it
      if (exam && savedExams.find(e => e.id === id && (e.output as NESAExam).examTitle === exam.examTitle)) {
        setExam(null);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete exam";
      toast.error(errorMessage);
    }
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
        return (
          <div className="space-y-4">
            <div className="text-lg font-medium mb-4">{question.prompt}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {question.matchingPairs?.map((pair, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                    {pair.left}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {question.matchingPairs?.map((pair, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
                    {pair.right}
                  </div>
                ))}
              </div>
            </div>
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-md"
              placeholder="Write your matches here (e.g., 1-A, 2-C, 3-B)"
              value={userAnswers[question.id] || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
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

  if (!exam) {
    return (
      <div className="space-y-6">
        {savedExams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Saved Exams
              </CardTitle>
              <CardDescription>
                Continue or delete your previous exams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loadingExams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  savedExams.map((savedExam) => {
                    const examData = savedExam.output as NESAExam;
                    return (
                      <div
                        key={savedExam.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium">{examData.examTitle}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(savedExam.createdAt), "MMM d, yyyy")}
                            </span>
                            <span>{examData.totalMarks} marks</span>
                            <span>{examData.questions.length} questions</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                            onClick={() => handleDeleteExam(savedExam.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Generate NESA Software Engineering Exam</CardTitle>
            <CardDescription>
              Create a realistic NSW HSC Software Engineering practice exam with interactive
              coding, SQL, and diagram questions
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
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition"
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{exam.examTitle}</CardTitle>
              <CardDescription>
                Total Marks: {exam.totalMarks} | Time Allowed: {exam.timeAllowed} minutes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportExamAsJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => setExam(null)}>
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

      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-3">
                  Question {currentQuestion.questionNumber}
                  <Badge>{currentQuestion.marks} {currentQuestion.marks === 1 ? "mark" : "marks"}</Badge>
                  <Badge variant="outline">{currentQuestion.type.toUpperCase()}</Badge>
                </CardTitle>
                <CardDescription>
                  {currentQuestion.modules.join(", ")}
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {currentQuestionIndex + 1} / {exam.questions.length}
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
                <ChevronLeft className="h-4 w-4 mr-2" />
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
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question Navigator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {exam.questions.map((q, idx) => (
              <Button
                key={q.id}
                variant={idx === currentQuestionIndex ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentQuestionIndex(idx)}
                className={userAnswers[q.id] ? "border-green-500" : ""}
              >
                Q{q.questionNumber}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
