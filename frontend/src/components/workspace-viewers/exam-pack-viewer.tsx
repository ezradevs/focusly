"use client";

import { FileText, Target, Award, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ExamPackData {
  questions: Array<{
    prompt: string;
    criteria: string[];
    bandSixSample?: string;
    evaluation?: {
      summary: string;
      strengths: string[];
      improvements: string[];
      indicativeBand?: string;
    };
  }>;
  reflectionPrompts?: string[];
}

interface ExamPackViewerProps {
  data: ExamPackData;
}

export function ExamPackViewer({ data }: ExamPackViewerProps) {
  if (!data.questions || data.questions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No exam questions available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Exam Pack</h3>
        <Badge variant="outline">{data.questions.length} Questions</Badge>
      </div>

      {/* Questions */}
      <Accordion type="single" collapsible className="space-y-3">
        {data.questions.map((question, index) => (
          <AccordionItem
            key={index}
            value={`exam-${index}`}
            className="rounded-lg border bg-background"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex flex-1 items-start gap-3 text-left">
                <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Question {index + 1}</span>
                    {question.evaluation?.indicativeBand && (
                      <Badge variant="secondary">{question.evaluation.indicativeBand}</Badge>
                    )}
                  </div>
                  <p className="pr-4 font-medium">{question.prompt}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-2">
                {/* Criteria */}
                {question.criteria && question.criteria.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Assessment Criteria</p>
                    </div>
                    <ul className="space-y-2">
                      {question.criteria.map((criterion, i) => (
                        <li key={i} className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                          <Badge variant="outline" className="h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 text-xs">
                            {i + 1}
                          </Badge>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Band 6 Sample */}
                {question.bandSixSample && (
                  <>
                    <Separator />
                    <div className="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:bg-green-950/20">
                      <div className="mb-3 flex items-center gap-2">
                        <Award className="h-5 w-5 text-green-600" />
                        <p className="font-semibold text-green-700 dark:text-green-300">Band 6 Sample Answer</p>
                      </div>
                      <MarkdownRenderer content={question.bandSixSample} />
                    </div>
                  </>
                )}

                {/* Evaluation */}
                {question.evaluation && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">Evaluation</p>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-4">
                        <MarkdownRenderer content={question.evaluation.summary} />
                      </div>

                      {question.evaluation.strengths && question.evaluation.strengths.length > 0 && (
                        <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-950/20">
                          <p className="mb-2 font-semibold text-green-700 dark:text-green-300">Strengths</p>
                          <ul className="space-y-1">
                            {question.evaluation.strengths.map((strength, i) => (
                              <li key={i} className="flex gap-2 text-sm">
                                <span className="text-green-600">✓</span>
                                <span>{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {question.evaluation.improvements && question.evaluation.improvements.length > 0 && (
                        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
                          <div className="mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                            <p className="font-semibold text-amber-700 dark:text-amber-300">Areas for Improvement</p>
                          </div>
                          <ul className="space-y-1">
                            {question.evaluation.improvements.map((improvement, i) => (
                              <li key={i} className="flex gap-2 text-sm">
                                <span className="text-amber-600">→</span>
                                <span>{improvement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Reflection Prompts */}
      {data.reflectionPrompts && data.reflectionPrompts.length > 0 && (
        <Card className="border-l-4 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Reflection Prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.reflectionPrompts.map((prompt, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
