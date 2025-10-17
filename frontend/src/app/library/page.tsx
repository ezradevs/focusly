"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { focuslyApi } from "@/lib/api";
import type { MemorisationResult, ModuleOutputRecord, StoredModuleType } from "@/types";
import { MODULES, MODULE_TYPE_MAP } from "@/constants/modules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Trash2, Eye, Calendar, BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { MemorisationViewer } from "@/components/workspace-viewers";

export default function LibraryPage() {
  const [outputs, setOutputs] = useState<ModuleOutputRecord[]>([]);
  const [filteredOutputs, setFilteredOutputs] = useState<ModuleOutputRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<StoredModuleType | "all">("all");
  const [viewingOutput, setViewingOutput] = useState<ModuleOutputRecord | null>(null);

  const fetchOutputs = async () => {
    try {
      setLoading(true);
      const response = await focuslyApi.listOutputs({ limit: 100 });
      setOutputs(response.outputs);
      setFilteredOutputs(response.outputs);
    } catch (error) {
      toast.error("Failed to load library");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOutputs();
  }, []);

  useEffect(() => {
    let filtered = outputs;

    // Filter by module
    if (selectedModule !== "all") {
      filtered = filtered.filter((output) => output.module === selectedModule);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (output) =>
          output.label?.toLowerCase().includes(query) ||
          output.subject?.toLowerCase().includes(query)
      );
    }

    setFilteredOutputs(filtered);
  }, [searchQuery, selectedModule, outputs]);

  const handleDelete = async (id: string) => {
    try {
      await focuslyApi.deleteOutput(id);
      setOutputs(outputs.filter((output) => output.id !== id));
      toast.success("Output deleted");
      setViewingOutput(null);
    } catch (error) {
      toast.error("Failed to delete output");
      console.error(error);
    }
  };

  const getModuleInfo = (moduleType: StoredModuleType) => {
    const moduleId = MODULE_TYPE_MAP[moduleType];
    return MODULES.find((m) => m.id === moduleId);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  const renderOutputContent = (output: ModuleOutputRecord) => {
    if (output.module === "MEMORISATION") {
      return (
        <Card className="border-muted-foreground/20">
          <CardContent className="pt-6">
            <MemorisationViewer data={output.output as MemorisationResult} />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(output.output, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  };

  const moduleTypes: Array<StoredModuleType | "all"> = [
    "all",
    "NOTES_SUMMARY",
    "QUESTION_SET",
    "QUIZ_SESSION",
    "FLASHCARD_DECK",
    "EXAM_PACK",
    "REVISION_PLAN",
    "LANGUAGE_PRACTICE",
    "MEMORISATION",
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground">
            Access all your saved AI-generated content in one place
          </p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by subject or label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Tabs value={selectedModule} onValueChange={(value) => setSelectedModule(value as StoredModuleType | "all")}>
            <TabsList className="w-full flex-wrap h-auto justify-start gap-2">
              {moduleTypes.map((type) => {
                const moduleInfo = type === "all" ? null : getModuleInfo(type);
                return (
                  <TabsTrigger key={type} value={type} className="gap-2">
                    {moduleInfo ? (
                      <>
                        <moduleInfo.icon className="h-3.5 w-3.5" />
                        {moduleInfo.label}
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        All Modules
                      </>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Showing {filteredOutputs.length} of {outputs.length} items
          </span>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
            </Badge>
          )}
          {selectedModule !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {getModuleInfo(selectedModule)?.label}
            </Badge>
          )}
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredOutputs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No outputs found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || selectedModule !== "all"
                  ? "Try adjusting your filters"
                  : "Start using modules to generate content"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOutputs.map((output) => {
              const moduleInfo = getModuleInfo(output.module);
              const Icon = moduleInfo?.icon;

              return (
                <Card key={output.id} className="group relative overflow-hidden transition-all hover:shadow-lg">
                  {/* Module Color Accent */}
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                      moduleInfo?.accent ?? "from-gray-400 to-gray-600"
                    )}
                  />

                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {Icon && (
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm",
                              moduleInfo?.accent
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Badge variant="outline" className="text-xs">
                            {moduleInfo?.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <CardTitle className="line-clamp-1 text-base">
                        {output.label || output.subject || "Untitled"}
                      </CardTitle>
                      {output.subject && output.label !== output.subject && (
                        <CardDescription className="line-clamp-1">
                          {output.subject}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(output.createdAt)}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setViewingOutput(output)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDelete(output.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingOutput} onOpenChange={() => setViewingOutput(null)}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          {viewingOutput && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {(() => {
                    const moduleInfo = getModuleInfo(viewingOutput.module);
                    const Icon = moduleInfo?.icon;
                    return Icon ? (
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br text-white",
                          moduleInfo?.accent
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    ) : null;
                  })()}
                  <div className="flex-1">
                    <DialogTitle>
                      {viewingOutput.label || viewingOutput.subject || "Output Details"}
                    </DialogTitle>
                    <DialogDescription>
                      {getModuleInfo(viewingOutput.module)?.label} • Created {formatDate(viewingOutput.createdAt)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {viewingOutput.subject && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Subject</h4>
                    <p className="text-sm text-muted-foreground">{viewingOutput.subject}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">Output</h4>
                  {renderOutputContent(viewingOutput)}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setViewingOutput(null)}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(viewingOutput.id)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
