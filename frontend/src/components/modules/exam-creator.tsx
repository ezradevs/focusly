"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCopy,
  FileOutput,
  FileText,
  Loader2,
  Play,
  Scale,
  Trash2,
} from "lucide-react";
import { useExamStore } from "@/store/exam";
import { SubjectSelect } from "@/components/subject-select";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ExamTakingViewer } from "@/components/exam/exam-taking-viewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExamQuestion, ExamResponse, SubjectValue } from "@/types";
import { focuslyApi } from "@/lib/api";
import { usePreferencesStore } from "@/store/preferences";
import { SUBJECT_VALUES } from "@/constants/subjects";
import { formatSubject } from "@/lib/utils";
import { ExamPackSkeleton } from "@/components/loading/exam-pack-skeleton";

const formSchema = z.object({
  examName: z.string().min(3, "Enter an exam name"),
  subject: z.enum(SUBJECT_VALUES),
  topics: z.string().min(5, "List at least one topic"),
  quantity: z.coerce.number().min(1).max(15),
  includeBandSixSample: z.boolean().default(false),
  userResponse: z.string().optional(),
});

type ExamFormValues = z.infer<typeof formSchema>;

export function ExamCreatorModule() {
  const preferences = usePreferencesStore();
  const queryClient = useQueryClient();
  const examStore = useExamStore();
  const form = useForm<ExamFormValues>({
    resolver: zodResolver(formSchema) as Resolver<ExamFormValues>,
    defaultValues: {
      examName: "",
      subject: preferences.subject,
      topics: "",
      quantity: 3,
      includeBandSixSample: true,
      userResponse: "",
    },
  });
  const [data, setData] = useState<ExamResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [takingExamId, setTakingExamId] = useState<string | null>(null);

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      preferences.update({ subject: values.subject, lastModule: "exam" });
      const payload = {
        ...values,
        topics: values.topics
          .split(/\n|,/)
          .map((topic) => topic.trim())
          .filter(Boolean),
        userResponse: values.userResponse?.trim() || undefined,
      };
      const response = await focuslyApi.createExamPrompts(payload);
      setData(response);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Exam-style questions generated");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create exam-style questions"
      );
    } finally {
      setIsLoading(false);
    }
  });

  const handleCopy = async () => {
    if (!data) return;
    const text = data.questions
      .map((question, index) => {
        const header = `Question ${index + 1}: ${question.prompt}`;
        const criteria = question.criteria
          .map((criterion) => ` - ${criterion}`)
          .join("\n");
        const evaluation = question.evaluation
          ? `Evaluation: ${question.evaluation.summary}`
          : "";
        return [header, "Criteria:", criteria, evaluation]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Copied exam pack");
  };

  const downloadJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "focusly-exam-pack.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleStartExam = () => {
    if (!data || !data.questions.length) return;

    const examName = form.getValues("examName") || "Untitled Exam";
    const subject = form.getValues("subject");

    const session = examStore.createSession(examName, subject, data.questions);
    setTakingExamId(session.id);
    toast.success("Exam started!");
  };

  const takingSession = takingExamId
    ? examStore.sessions.find((s) => s.id === takingExamId)
    : null;

  if (takingSession) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-[calc(100vh-200px)]"
      >
        <ExamTakingViewer
          session={takingSession}
          onSaveAnswer={(answer) => examStore.saveAnswer(takingSession.id, answer)}
          onComplete={() => {
            examStore.completeSession(takingSession.id);
            setTakingExamId(null);
          }}
          onPause={() => examStore.pauseSession(takingSession.id)}
          onResume={() => examStore.resumeSession(takingSession.id)}
          onClose={() => setTakingExamId(null)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Exam-Style Creator</CardTitle>
          <CardDescription>
            Generate realistic extended-response questions with high-band exemplars and targeted evaluation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="examName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exam name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Biology Module 5 Practice Exam"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  name="topics"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key topics or outcomes</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="List syllabus outcomes or dot points on separate lines"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="userResponse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Optional student response</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Paste your best draft for evaluation (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of questions (1-15)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={15} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeBandSixSample"
                  render={({ field }) => (
                    <FormItem className="flex items-start justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">Band 6 sample answer</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Include a top-band exemplar for each question.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? "Included" : "Excluded"}
                      </Button>
                    </FormItem>
                  )}
                />

                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Export ready</p>
                  <p>
                    Download structured JSON or copy Markdown to slot straight into your LMS or revision notes.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate exam
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleStartExam}
                    disabled={!data}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start exam
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCopy} disabled={!data}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    Copy pack
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadJSON} disabled={!data}>
                    <FileOutput className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Exam pack overview
            </CardTitle>
            <CardDescription>
              Generating your exam questions...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExamPackSkeleton count={form.getValues("quantity")} />
          </CardContent>
        </Card>
      )}

      {!isLoading && data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Exam pack overview
            </CardTitle>
            <CardDescription>
              Review prompts, marking criteria, exemplar responses, and AI evaluation in a structured, exportable format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="questions">
              <TabsList>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="evaluation" disabled={!data.reflectionPrompts?.length}>
                  Reflection prompts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="questions" className="mt-4">
                <Accordion type="single" collapsible className="space-y-3">
                  {data.questions.map((question, index) => (
                    <AccordionItem key={question.id ?? index} value={`${index}`} className="border rounded-lg">
                      <AccordionTrigger className="px-3 text-left">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-medium">
                            Question {index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {question.criteria.length} marking points
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <QuestionDetail question={question} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </TabsContent>

              <TabsContent value="evaluation" className="mt-4">
                <div className="space-y-3 text-sm">
                  {data.reflectionPrompts?.map((prompt, index) => (
                    <div key={index} className="rounded-lg border bg-muted/30 p-3">
                      <p className="font-medium">Prompt {index + 1}</p>
                      <p className="text-muted-foreground">{prompt}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Exam History */}
      {examStore.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  Exam History
                </CardTitle>
                <CardDescription>
                  Your past exam attempts are saved locally. Resume incomplete exams or review completed ones.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {examStore.sessions.map((session) => {
                  const answeredCount = session.answers.length;
                  const totalQuestions = session.questions.length;
                  const isComplete = session.completedAt !== null && session.completedAt !== undefined;
                  const completionRate = totalQuestions > 0
                    ? (answeredCount / totalQuestions) * 100
                    : 0;

                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 rounded-lg border bg-background p-4"
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                          isComplete
                            ? "bg-green-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.examName}</p>
                          {isComplete && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Completed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {formatSubject(session.subject)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(session.startedAt).toLocaleDateString()}
                          </span>
                          <span>
                            {answeredCount}/{totalQuestions} answered
                          </span>
                        </div>
                        {!isComplete && (
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{Math.round(completionRate)}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isComplete && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setTakingExamId(session.id)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            {answeredCount > 0 ? "Resume" : "Start"}
                          </Button>
                        )}
                        {isComplete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTakingExamId(session.id)}
                          >
                            <BookOpen className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            examStore.deleteSession(session.id);
                            toast.success("Exam session deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function QuestionDetail({ question }: { question: ExamQuestion }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <p className="text-xs uppercase text-muted-foreground">Prompt</p>
        <MarkdownRenderer content={question.prompt} />
      </section>

      <section>
        <p className="text-xs uppercase text-muted-foreground">Marking criteria</p>
        <ul className="mt-2 space-y-1">
          {question.criteria.map((criterion, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
      </section>

      {question.bandSixSample && (
        <section className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs uppercase text-muted-foreground">Band 6 exemplar</p>
          <MarkdownRenderer content={question.bandSixSample} />
        </section>
      )}

      {question.evaluation && (
        <section className="rounded-lg border bg-primary/5 p-3">
          <p className="text-xs uppercase text-primary">Evaluation summary</p>
          <p>{question.evaluation.summary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md bg-background/80 p-3">
              <p className="text-xs uppercase text-muted-foreground">Strengths</p>
              <ul className="mt-2 space-y-1">
                {question.evaluation.strengths.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md bg-background/80 p-3">
              <p className="text-xs uppercase text-muted-foreground">Focus areas</p>
              <ul className="mt-2 space-y-1">
                {question.evaluation.improvements.map((item, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {question.evaluation.indicativeBand && (
            <p className="mt-3 text-xs text-muted-foreground">
              Indicative band: {question.evaluation.indicativeBand}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
