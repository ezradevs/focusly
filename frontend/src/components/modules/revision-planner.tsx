"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Download, Loader2, Map } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { PlannerResult } from "@/types";
import { focuslyApi } from "@/lib/api";

const formSchema = z.object({
  subjects: z.string().min(3, "Add at least one subject"),
  topics: z.string().min(3, "Add at least one topic"),
  examDate: z.string(),
  studyDaysPerWeek: z.coerce.number().min(1).max(7),
  focusAreas: z.string().optional(),
});

type PlannerFormValues = z.infer<typeof formSchema>;

export function RevisionPlannerModule() {
  const form = useForm<PlannerFormValues>({
    resolver: zodResolver(formSchema) as Resolver<PlannerFormValues>,
    defaultValues: {
      subjects: "Biology",
      topics: "Genetics\nCell respiration",
      examDate: new Date().toISOString().slice(0, 10),
      studyDaysPerWeek: 5,
      focusAreas: "",
    },
  });
  const [plan, setPlan] = useState<PlannerResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      const payload = {
        subjects: values.subjects
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        topics: values.topics
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        examDate: values.examDate,
        focusAreas: values.focusAreas
          ?.split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        studyDaysPerWeek: values.studyDaysPerWeek,
      };

      const response = await focuslyApi.buildRevisionPlan(payload);
      setPlan(response);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Revision plan ready");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not build planner");
    } finally {
      setIsLoading(false);
    }
  });

  const downloadPlan = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "focusly-revision-plan.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireAuth>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"
      >
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Revision Planner</CardTitle>
          <CardDescription>
            Generate a week-by-week plan with day-level actions, balanced workload, and success tips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <FormField
                control={form.control}
                name="subjects"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subjects</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="e.g. Biology\nChemistry"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="topics"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority topics</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="List the concepts or chapters to cover"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="focusAreas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Focus areas (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Trouble topics, exam skills, practicals..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="examDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exam date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="studyDaysPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Study days per week</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={7} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Planning
                    </>
                  ) : (
                    <>
                      <Map className="mr-2 h-4 w-4" />
                      Generate plan
                    </>
                  )}
                </Button>
                <Button type="button" variant="secondary" disabled={!plan} onClick={downloadPlan}>
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              Plan preview
            </CardTitle>
            <CardDescription>
              Scroll through the timeline. Each day can be printed or exported for revision logs.
            </CardDescription>
          </div>
          {plan && <Badge variant="outline">{plan.plan.length} weeks</Badge>}
        </CardHeader>
        <CardContent className="p-0">
          {plan ? (
            <ScrollArea className="h-[620px]">
              <div className="space-y-6 p-6">
                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <MarkdownRenderer content={plan.overview} />
                </div>
                {plan.plan.map((week, weekIndex) => (
                  <motion.div
                    key={week.weekLabel}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: weekIndex * 0.05 }}
                    className="rounded-xl border bg-background/70 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{week.weekLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {week.startDate} → {week.endDate}
                        </p>
                      </div>
                      <Badge variant="secondary">{week.days.length} study days</Badge>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      {week.days.map((day) => (
                        <div key={day.date} className="rounded-lg border bg-muted/20 p-4">
                          <p className="text-sm font-medium">
                            {new Date(day.date).toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <Separator className="my-3" />
                          <ul className="space-y-2 text-sm">
                            {day.focus.map((activity, activityIndex) => (
                              <li
                                key={`${day.date}-${activityIndex}`}
                                className="flex flex-col rounded-md border bg-background/80 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold">{activity.subject}</span>
                                  <Badge variant="outline">
                                    {activity.estimatedMinutes} mins
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {activity.topic}
                                </p>
                                <p className="text-sm">{activity.activity}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
                {plan.successTips && plan.successTips.length > 0 && (
                  <div className="rounded-lg border bg-primary/5 p-4 text-sm">
                    <p className="text-xs uppercase text-primary">Success tips</p>
                    <ul className="mt-2 space-y-1">
                      {plan.successTips.map((tip, index) => (
                        <li key={index} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex h-[620px] flex-col items-center justify-center gap-4 bg-muted/30 text-center text-sm text-muted-foreground">
              <Map className="h-10 w-10 text-muted-foreground/60" />
              <p>Fill out the planner inputs to generate a tailored study roadmap.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
    </RequireAuth>
  );
}
