"use client";

import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCopy,
  ClipboardList,
  Loader2,
  Play,
  Sparkles,
  Upload,
} from "lucide-react";
import { SubjectSelect } from "@/components/subject-select";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { GeneratedQuestion, QuestionType, SubjectValue } from "@/types";
import { focuslyApi } from "@/lib/api";
import { usePreferencesStore } from "@/store/preferences";
import { useQuizStore } from "@/store/quiz";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SUBJECT_VALUES } from "@/constants/subjects";
import { formatQuestionType } from "@/lib/utils";
import { QuestionSetSkeleton } from "@/components/loading/question-set-skeleton";

const questionTypes: QuestionType[] = ["mcq", "short-answer", "extended"];

const formSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  promptSource: z.enum(["topic", "notes"]).default("topic"),
  content: z.string().min(10, "Provide a topic or source material."),
  questionCount: z.coerce
    .number()
    .min(1, "At least 1 question")
    .max(20, "Maximum 20 at a time"),
  questionTypes: z.array(z.enum(["mcq", "short-answer", "extended"])).min(1),
  includeMarkingGuides: z.boolean().default(false),
});

type QuestionFormValues = z.infer<typeof formSchema>;

export function QuestionGeneratorModule() {
  const preferences = usePreferencesStore();
  const quizStore = useQuizStore();
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(formSchema) as Resolver<QuestionFormValues>,
    defaultValues: {
      subject: preferences.subject,
      promptSource: "topic",
      content: "",
      questionCount: preferences.questionCount,
      questionTypes: preferences.questionTypes,
      includeMarkingGuides: preferences.includeMarkingGuides,
    },
  });

  const activeCount = useMemo(() => questions.length, [questions]);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      preferences.update({
        subject: values.subject,
        questionCount: values.questionCount,
        questionTypes: values.questionTypes,
        includeMarkingGuides: values.includeMarkingGuides,
        lastModule: "questions",
      });

      const response = await focuslyApi.generateQuestions(values);
      setQuestions(response.questions);
      quizStore.setStagedQuestions(response.questions);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Generated question set saved for Quiz Mode");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate questions."
      );
    } finally {
      setIsLoading(false);
    }
  });

  const handleCopy = async () => {
    if (!questions.length) return;
    const markdown = questions
      .map((question, index) => {
        const number = index + 1;
        const header = `${number}. (${question.type.toUpperCase()}) ${
          question.prompt
        }`;
        const options = question.options
          ?.map((option) => `   - ${option.label}. ${option.value}`)
          .join("\n");
        const answer = `Answer: ${question.answer}`;
        const explanation = `Explanation: ${question.explanation}`;
        const marking =
          question.markingGuide && `Marking guide: ${question.markingGuide}`;
        return [header, options, answer, explanation, marking]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    await navigator.clipboard.writeText(markdown);
    toast.success("Questions copied to clipboard");
  };

  const launchQuiz = () => {
    if (!questions.length) {
      toast.message("Generate questions first", {
        description: "Create a question set before launching Quiz Mode.",
      });
      return;
    }
    const session = quizStore.createSession(questions);
    quizStore.setActiveSession(session.id);
    toast.success("Quiz session created. Jump to Quiz Mode to begin.");
  };

  return (
    <RequireAuth>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-semibold">
              Question Generator
            </CardTitle>
          </div>
          <CardDescription>
            Produce targeted questions for revision, class discussion, or
            self-testing. Supports MCQ, short answer, and extended responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <SubjectSelect
                          value={field.value as SubjectValue}
                          onChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="promptSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="topic">Topic or syllabus dot</SelectItem>
                          <SelectItem value="notes">
                            Raw notes / extracted text
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic or source text</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={8}
                        placeholder="e.g. Explain cellular respiration focusing on the Krebs cycle..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="questionCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of questions</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          inputMode="numeric"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="questionTypes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Question types</FormLabel>
                      <ToggleGroup
                        type="multiple"
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(
                            (value as QuestionType[])?.length
                              ? value
                              : field.value
                          )
                        }
                        className="flex flex-wrap gap-2"
                      >
                        {questionTypes.map((type) => (
                          <ToggleGroupItem
                            key={type}
                            value={type}
                          >
                            {formatQuestionType(type)}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="includeMarkingGuides"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Include marking guides
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Adds high-level criteria for extended responses.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(!field.value)}
                    >
                      {field.value ? "Enabled" : "Disabled"}
                    </Button>
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate set
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!questions.length}
                >
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy set
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={launchQuiz}
                  disabled={!questions.length}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Send to Quiz Mode
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <span>Generated questions</span>
            <Badge variant="outline">
              {activeCount} {activeCount === 1 ? "question" : "questions"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Preview questions before launching Quiz Mode or exporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ScrollArea className="h-[520px] pr-4">
              <QuestionSetSkeleton count={form.getValues("questionCount")} />
            </ScrollArea>
          ) : !questions.length ? (
            <EmptyState />
          ) : (
            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-lg border bg-background/70 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {(index + 1).toString().padStart(2, "0")}
                        </Badge>
                        <Badge variant="outline">
                          {formatQuestionType(question.type)}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-3 text-sm leading-relaxed">
                      <MarkdownRenderer content={question.prompt} />
                      {question.options && (
                        <div className="space-y-1">
                          {question.options.map((option) => (
                            <p key={option.label} className="flex gap-2">
                              <span className="font-medium">
                                {option.label}.
                              </span>
                              <span>{option.value}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Model answer
                        </p>
                        <p>{question.answer}</p>
                      </div>
                      <div className="rounded-md bg-muted/30 p-3 text-muted-foreground">
                        <p className="text-xs font-semibold uppercase">
                          Explanation
                        </p>
                        <p>{question.explanation}</p>
                      </div>
                      {question.markingGuide && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase text-primary">
                            Marking criteria
                          </p>
                          <p>{question.markingGuide}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
    </RequireAuth>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
      <Upload className="h-10 w-10 text-muted-foreground/70" />
      <div className="space-y-2">
        <p className="text-base font-medium text-foreground">
          Generate a question set to preview it here.
        </p>
        <p>
          Mix MCQs with extended responses to create a balanced practice deck.
          You can pipe the set straight into Quiz Mode at any time.
        </p>
      </div>
    </div>
  );
}
