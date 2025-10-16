"use client";

import { CheckCircle2, Circle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatQuestionType } from "@/lib/utils";

interface Question {
  id?: string;
  type: "mcq" | "short-answer" | "extended";
  prompt: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
  answer: string;
  explanation: string;
  markingGuide?: string;
}

interface QuestionSetData {
  questions: Question[];
}

interface QuestionSetViewerProps {
  data: QuestionSetData;
}


const QUESTION_TYPE_COLORS: Record<Question["type"], string> = {
  mcq: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "short-answer": "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  extended: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

export function QuestionSetViewer({ data }: QuestionSetViewerProps) {
  if (!data.questions || data.questions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No questions available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Question Set</h3>
        <Badge variant="outline">{data.questions.length} Questions</Badge>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {data.questions.map((question, index) => (
          <AccordionItem
            key={question.id || index}
            value={`question-${index}`}
            className="rounded-lg border bg-background"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex flex-1 items-start gap-3 text-left">
                <HelpCircle className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={QUESTION_TYPE_COLORS[question.type]}>
                      {formatQuestionType(question.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Question {index + 1}</span>
                  </div>
                  <p className="pr-4 font-medium">{question.prompt}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-2">
                {/* MCQ Options */}
                {question.type === "mcq" && question.options && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Options</p>
                    <div className="space-y-2">
                      {question.options.map((option) => {
                        const isCorrect = option.label === question.answer;
                        return (
                          <div
                            key={option.label}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${
                              isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "bg-muted/30"
                            }`}
                          >
                            {isCorrect ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                            ) : (
                              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <span className="font-semibold">{option.label}.</span> {option.value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Model Answer */}
                <div className="rounded-lg bg-primary/5 p-4">
                  <p className="mb-2 text-sm font-semibold text-primary">Model Answer</p>
                  <MarkdownRenderer content={question.answer} />
                </div>

                {/* Explanation */}
                {question.explanation && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="mb-2 text-sm font-semibold">Explanation</p>
                    <MarkdownRenderer content={question.explanation} />
                  </div>
                )}

                {/* Marking Guide */}
                {question.markingGuide && (
                  <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
                    <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Marking Guide
                    </p>
                    <MarkdownRenderer content={question.markingGuide} />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
