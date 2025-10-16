"use client";

import { Check, Lightbulb, BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface NotesSummaryData {
  summary: string;
  keyPoints: string[];
  definitions: Array<{
    term: string;
    definition: string;
  }>;
  followUpSuggestions?: Array<{
    title: string;
    description: string;
  }>;
}

interface NotesSummaryViewerProps {
  data: NotesSummaryData;
}

export function NotesSummaryViewer({ data }: NotesSummaryViewerProps) {
  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownRenderer content={data.summary} />
        </CardContent>
      </Card>

      {/* Key Points */}
      {data.keyPoints && data.keyPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5 text-green-600" />
              Key Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.keyPoints.map((point, index) => (
                <li key={index} className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">
                    {index + 1}
                  </Badge>
                  <span className="text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Definitions */}
      {data.definitions && data.definitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Definitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.definitions.map((def, index) => (
                <div key={index} className="rounded-lg border bg-muted/30 p-4">
                  <h4 className="mb-2 font-semibold text-primary">{def.term}</h4>
                  <p className="text-sm text-muted-foreground">{def.definition}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-up Suggestions */}
      {data.followUpSuggestions && data.followUpSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Follow-up Suggestions
            </CardTitle>
            <CardDescription>Explore these topics next to deepen your understanding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.followUpSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
                >
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  <div>
                    <p className="font-medium">{suggestion.title}</p>
                    <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
