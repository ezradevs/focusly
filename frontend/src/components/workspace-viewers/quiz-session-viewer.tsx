"use client";

import { CheckCircle2, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface QuizSessionData {
  isCorrect: boolean;
  feedback: string;
  improvementTips: string[];
}

interface QuizSessionViewerProps {
  data: QuizSessionData;
}

export function QuizSessionViewer({ data }: QuizSessionViewerProps) {
  return (
    <div className="space-y-4">
      {/* Result Card */}
      <Card className={data.isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-red-500 bg-red-50 dark:bg-red-950/20"}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {data.isCorrect ? (
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            ) : (
              <XCircle className="h-12 w-12 text-red-600" />
            )}
            <div>
              <h3 className="text-2xl font-bold">
                {data.isCorrect ? "Correct!" : "Incorrect"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {data.isCorrect ? "Great work! Keep it up." : "Let's review this together."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-primary" />
            Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownRenderer content={data.feedback} />
        </CardContent>
      </Card>

      {/* Improvement Tips */}
      {data.improvementTips && data.improvementTips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Improvement Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.improvementTips.map((tip, index) => (
                <li key={index} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">
                    {index + 1}
                  </Badge>
                  <span className="text-sm leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
