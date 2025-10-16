"use client";

import { Calendar, Clock, BookOpen, Target, Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface RevisionPlanData {
  overview: string;
  plan: Array<{
    weekLabel: string;
    startDate: string;
    endDate: string;
    days: Array<{
      date: string;
      focus: Array<{
        subject: string;
        topic: string;
        activity: string;
        estimatedMinutes: number;
      }>;
    }>;
  }>;
  successTips?: string[];
}

interface RevisionPlanViewerProps {
  data: RevisionPlanData;
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  } catch {
    return dateStr;
  }
}

export function RevisionPlanViewer({ data }: RevisionPlanViewerProps) {
  if (!data.plan || data.plan.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No revision plan available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card className="border-l-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Plan Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownRenderer content={data.overview} />
        </CardContent>
      </Card>

      {/* Weekly Breakdown */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Weekly Schedule</h3>
        <Accordion type="single" collapsible className="space-y-3">
          {data.plan.map((week, weekIndex) => {
            const totalMinutes = week.days.reduce(
              (sum, day) =>
                sum + day.focus.reduce((daySum, session) => daySum + session.estimatedMinutes, 0),
              0
            );
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            return (
              <AccordionItem
                key={weekIndex}
                value={`week-${weekIndex}`}
                className="rounded-lg border bg-background"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between pr-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <p className="font-semibold">{week.weekLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(week.startDate)} - {formatDate(week.endDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {hours > 0 && `${hours}h `}{minutes > 0 && `${minutes}m`}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 pt-2">
                    {week.days.map((day, dayIndex) => {
                      if (day.focus.length === 0) return null;

                      return (
                        <div key={dayIndex} className="rounded-lg border bg-muted/20 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-semibold">{formatDateFull(day.date)}</p>
                            <Badge variant="secondary" className="text-xs">
                              {day.focus.length} {day.focus.length === 1 ? "session" : "sessions"}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {day.focus.map((session, sessionIndex) => (
                              <div
                                key={sessionIndex}
                                className="flex items-start gap-3 rounded-lg border bg-background p-3"
                              >
                                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {session.subject}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">
                                      {session.topic}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium">{session.activity}</p>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{session.estimatedMinutes} minutes</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Success Tips */}
      {data.successTips && data.successTips.length > 0 && (
        <Card className="border-l-4 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-green-600" />
              Success Tips
            </CardTitle>
            <CardDescription>Follow these tips to make the most of your revision plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.successTips.map((tip, index) => (
                <li key={index} className="flex gap-3 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full border-green-500 p-0 text-green-600">
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
