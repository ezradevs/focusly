"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { focuslyApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MODULES, MODULE_TYPE_MAP } from "@/constants/modules";
import type {
  ModuleOutputRecord,
  StoredModuleType,
  SummaryResult,
  GeneratedQuestion,
  QuizSession,
  FlashcardBuilderResponse,
  ExamResponse,
  PlannerResult,
} from "@/types";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  NotesSummaryViewer,
  QuestionSetViewer,
  QuizSessionViewer,
  FlashcardDeckViewer,
  ExamPackViewer,
  RevisionPlanViewer,
  MemorisationViewer,
} from "@/components/workspace-viewers";
import type { MemorisationResult } from "@/types";
import { formatSubject } from "@/lib/utils";

interface SavedOutputsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const moduleFilterOptions: Array<{ label: string; value: StoredModuleType | "all" }> = [
  { label: "All modules", value: "all" },
  { label: "Notes Summaries", value: "NOTES_SUMMARY" },
  { label: "Question Sets", value: "QUESTION_SET" },
  { label: "Quiz Sessions", value: "QUIZ_SESSION" },
  { label: "Flashcard Decks", value: "FLASHCARD_DECK" },
  { label: "Exam Packs", value: "EXAM_PACK" },
  { label: "Revision Plans", value: "REVISION_PLAN" },
  { label: "Memorisation Studio", value: "MEMORISATION" },
];

const moduleMetaById = new Map(MODULES.map((module) => [module.id, module]));

function getModuleLabel(module: StoredModuleType) {
  const moduleId = MODULE_TYPE_MAP[module];
  const meta = moduleMetaById.get(moduleId);
  if (!meta) return module;
  return meta.label;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function SavedOutputsDrawer({ open, onOpenChange }: SavedOutputsDrawerProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<StoredModuleType | "all">("all");
  const [selectedOutputId, setSelectedOutputId] = React.useState<string | null>(null);
  const [labelDraft, setLabelDraft] = React.useState<string>("");
  const [showInputContext, setShowInputContext] = React.useState(false);

  const outputsQuery = useQuery({
    queryKey: ["outputs", filter],
    queryFn: async () => {
      const response = await focuslyApi.listOutputs({
        module: filter === "all" ? undefined : filter,
        limit: 100,
      });
      return response.outputs;
    },
    enabled: open,
  });

  const outputs = React.useMemo(
    () => outputsQuery.data ?? [],
    [outputsQuery.data]
  );

  const selectedOutput = React.useMemo(() => {
    if (!selectedOutputId) return outputs[0];
    return outputs.find((output) => output.id === selectedOutputId) ?? outputs[0];
  }, [outputs, selectedOutputId]);

  React.useEffect(() => {
    if (selectedOutput) {
      setSelectedOutputId(selectedOutput.id);
      setLabelDraft(selectedOutput.label ?? "");
    } else {
      setLabelDraft("");
    }
  }, [selectedOutput]);

  const updateLabelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const response = await focuslyApi.updateOutputLabel(id, label);
      return response.output;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Saved label");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Unable to save label");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await focuslyApi.deleteOutput(id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Deleted saved output");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete record");
    },
  });

  const handleSaveLabel = () => {
    if (!selectedOutput) return;
    if (!labelDraft.trim()) {
      toast.error("Label cannot be empty.");
      return;
    }
    updateLabelMutation.mutate({ id: selectedOutput.id, label: labelDraft.trim() });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleCopy = async (output: ModuleOutputRecord["output"]) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
      toast.success("Copied output to clipboard");
    } catch {
      toast.error("Unable to copy output");
    }
  };

  const renderModuleOutput = (output: ModuleOutputRecord) => {
    try {
      switch (output.module) {
        case "NOTES_SUMMARY":
          return <NotesSummaryViewer data={output.output as SummaryResult} />;
        case "QUESTION_SET":
          return <QuestionSetViewer data={output.output as { questions: GeneratedQuestion[] }} />;
        case "QUIZ_SESSION":
          return <QuizSessionViewer data={output.output as QuizSession} />;
        case "FLASHCARD_DECK":
          return <FlashcardDeckViewer data={output.output as FlashcardBuilderResponse} />;
        case "EXAM_PACK":
          return <ExamPackViewer data={output.output as ExamResponse} />;
        case "REVISION_PLAN":
          return <RevisionPlanViewer data={output.output as PlannerResult} />;
        case "MEMORISATION":
          return (
            <MemorisationViewer data={output.output as MemorisationResult} />
          );
        default:
          return (
            <div className="rounded-lg border bg-muted/20 p-4">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {JSON.stringify(output.output, null, 2)}
              </pre>
            </div>
          );
      }
    } catch (error) {
      return (
        <div className="rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="text-sm text-red-600">Unable to render output. Data may be corrupted.</p>
        </div>
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full space-y-4 sm:max-w-4xl lg:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Saved workspace</SheetTitle>
          <SheetDescription>
            Browse and export AI generated content saved to your Focusly account.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Filter by module
          </label>
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger>
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              {moduleFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {outputsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading saved outputs…
          </div>
        ) : outputsQuery.isError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Unable to load saved outputs. Try again after signing in.
            <Button
              variant="outline"
              size="sm"
              onClick={() => outputsQuery.refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : outputs.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-5 w-5" />
            <p>No saved results yet. Generate content while signed in to capture it automatically.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <ScrollArea className="h-[540px] rounded-lg border">
              <div className="divide-y">
                {outputs.map((output) => (
                  <button
                    key={output.id}
                    onClick={() => {
                      setSelectedOutputId(output.id);
                      setLabelDraft(output.label ?? "");
                    }}
                    className={cn(
                      "w-full space-y-1 px-4 py-3 text-left transition hover:bg-muted/60",
                      output.id === selectedOutput?.id && "bg-primary/5"
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {output.label ?? getModuleLabel(output.module)}
                      </p>
                      {output.subject && (
                        <p className="text-xs font-medium text-primary">
                          {formatSubject(output.subject)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(output.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="mt-2">
                      {getModuleLabel(output.module)}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>

            {selectedOutput ? (
              <div className="flex h-[540px] flex-col gap-4 overflow-hidden rounded-lg border bg-background p-4">
                {/* Header Actions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        {selectedOutput.label ?? getModuleLabel(selectedOutput.module)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedOutput.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{getModuleLabel(selectedOutput.module)}</Badge>
                  </div>
                  <Input
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    placeholder="Add a label"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveLabel}
                      disabled={updateLabelMutation.isPending}
                    >
                      {updateLabelMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Save className="mr-2 h-4 w-4" /> Save label
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopy(selectedOutput.output)}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowInputContext(!showInputContext)}
                    >
                      {showInputContext ? (
                        <>
                          <ChevronUp className="mr-2 h-4 w-4" /> Hide Input
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-2 h-4 w-4" /> Show Input
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(selectedOutput.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Module-specific Output Viewer */}
                <ScrollArea className="flex-1 pr-4">
                  {renderModuleOutput(selectedOutput)}
                </ScrollArea>

                {/* Collapsible Input Context */}
                {showInputContext && (
                  <>
                    <Separator />
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Input Context
                      </p>
                      <ScrollArea className="max-h-32">
                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(selectedOutput.input, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex h-[540px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 text-sm text-muted-foreground">
                Select a saved output to inspect details.
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
