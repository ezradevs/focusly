"use client";

import { useCallback, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCopy,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { SubjectSelect } from "@/components/subject-select";
import { usePreferencesStore } from "@/store/preferences";
import { focuslyApi } from "@/lib/api";
import { SUBJECT_VALUES } from "@/constants/subjects";
import type { SubjectValue, SummaryResult } from "@/types";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { NotesSummarySkeleton } from "@/components/loading/notes-summary-skeleton";
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
  FormDescription,
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

const formSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  tone: z.enum(["concise", "exam-focus"]),
  text: z.string().min(40, "Paste at least a paragraph of notes."),
});

type NotesFormValues = z.infer<typeof formSchema>;

export function NotesSummariserModule() {
  const preferences = usePreferencesStore();
  const queryClient = useQueryClient();
  const form = useForm<NotesFormValues>({
    resolver: zodResolver(formSchema) as Resolver<NotesFormValues>,
    defaultValues: {
      subject: preferences.subject,
      tone: preferences.tone,
      text: "",
    },
  });
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toneLabel = useMemo(
    () => ({
      concise: "Concise",
      "exam-focus": "Exam Focus",
    }),
    []
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      const allowedTypes = ["text/plain", "text/markdown", "application/json", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Upload .txt, .md, .json, or .pdf files only.");
        return;
      }

      try {
        let text = "";

        if (file.type === "application/pdf") {
          toast.info("Extracting text from PDF...");

          try {
            // Dynamically import PDF.js to avoid SSR issues
            const pdfjsLib = await import("pdfjs-dist");

            // Configure worker to use local file
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf-worker/pdf.worker.min.mjs";

            // Extract text from PDF
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const textParts: string[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = content.items
                .map((item) => {
                  if ("str" in item) {
                    return item.str;
                  }
                  return "";
                })
                .join(" ");
              textParts.push(pageText);
            }

            text = textParts.join("\n\n");

            if (!text.trim()) {
              toast.warning("PDF appears to be empty or contains only images");
              return;
            }
          } catch (pdfError) {
            console.error("PDF parsing error:", pdfError);
            toast.error(`PDF error: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
            return;
          }
        } else {
          // Handle text files
          text = await file.text();
        }

        form.setValue("text", text, { shouldDirty: true, shouldTouch: true });
        toast.success(`Loaded ${file.name}`);
      } catch (error) {
        console.error("File upload error:", error);
        toast.error("Failed to read file. Please try again.");
      }
    },
    [form]
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    setError(null);

    try {
      preferences.update({
        subject: values.subject,
        tone: values.tone,
        lastModule: "notes",
      });

      const data = await focuslyApi.summariseNotes(values);
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Summary ready");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to summarise notes.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  });

  const handleCopy = async () => {
    if (!result) return;
    const content = [
      "# Summary",
      result.summary,
      "",
      "## Key Points",
      ...result.keyPoints.map((point) => `- ${point}`),
      "",
      "## Definitions",
      ...result.definitions.map(
        (def) => `- **${def.term}** — ${def.definition}`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(content);
    toast.success("Copied summary to clipboard");
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "focusly-summary.json";
    anchor.click();
    URL.revokeObjectURL(url);
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
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">
            Notes Summariser
          </CardTitle>
          <CardDescription>
            Paste or upload your notes to generate a concise study pack with key
            points and terminology.
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
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(toneLabel).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Tailor the summary towards quick reviews or exam focus.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={10}
                        placeholder="Paste your lecture notes, textbook extracts, or bullet points here..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Supports Markdown. Upload .txt, .md, .json, or .pdf files.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-2 text-sm hover:border-primary">
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload notes file</span>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleFileUpload(file);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Summarise Notes
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    form.reset({
                      subject: preferences.subject,
                      tone: preferences.tone,
                      text: "",
                    });
                    setResult(null);
                    setError(null);
                  }}
                  aria-label="Reset form"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">
              Summary Output
            </CardTitle>
            <CardDescription>
              Rendered with Markdown support including maths, code, and bullet
              lists.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!result}
              className="gap-2"
            >
              <ClipboardCopy className="h-4 w-4" /> Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!result}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {isLoading && <NotesSummarySkeleton />}
          {!isLoading && !result && !error && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              <NotebookIntro />
            </div>
          )}
          {!isLoading && result && !error && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <section>
                <h3 className="text-lg font-semibold">Summary</h3>
                <MarkdownRenderer content={result.summary} />
              </section>

              <section>
                <h3 className="text-lg font-semibold">Key Points</h3>
                <ul className="space-y-2">
                  {result.keyPoints.map((point, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-sm leading-relaxed"
                    >
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary/60" />
                      <span>{point}</span>
                    </motion.li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold">Definitions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.definitions.map((item, index) => (
                    <motion.div
                      key={`${item.term}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-lg border bg-background/70 p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold">{item.term}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.definition}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </section>

              {result.followUpSuggestions && (
                <section>
                  <h3 className="text-lg font-semibold">Next Steps</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.followUpSuggestions.map((item, index) => (
                      <motion.div
                        key={`${item.title}-${index}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
                      >
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-muted-foreground">
                          {item.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
    </RequireAuth>
  );
}

function NotebookIntro() {
  return (
    <div className="space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <p className="text-base font-medium text-foreground">
          Your summary will display here.
        </p>
        <p>
          Keep paragraphs to 2,000 characters for best results. After generating
          a summary, copy it to your clipboard or export to JSON for revision
          later.
        </p>
      </div>
    </div>
  );
}
