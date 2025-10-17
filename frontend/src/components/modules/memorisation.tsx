"use client";

import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, ScrollText, Brain, ClipboardCopy, Loader2, Rocket } from "lucide-react";

import { RequireAuth } from "@/components/auth/require-auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { focuslyApi } from "@/lib/api";
import { usePreferencesStore } from "@/store/preferences";
import type {
  EssayCoachResponse,
  MnemonicResponse,
  RecallDrillResponse,
  SubjectValue,
} from "@/types";
import { SUBJECT_VALUES } from "@/constants/subjects";
import { cn } from "@/lib/utils";
import {
  EssayCoachResultView,
  MnemonicResultView,
  RecallDrillResultView,
} from "@/components/workspace-viewers/memorisation-viewer";

const mnemonicSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  focusArea: z.string().trim().optional(),
  keyIdeas: z.string().min(10, "Share the content you want to memorise."),
  preferredStyle: z.enum(["acrostic", "story", "visual", "chunking", "rhythm"]),
});

type MnemonicFormValues = z.infer<typeof mnemonicSchema>;

const essayCoachSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  essayTitle: z.string().min(3, "Give your essay a short title."),
  essayText: z.string().min(120, "Paste at least a paragraph to analyse."),
  rehearsalWindowDays: z.coerce
    .number()
    .min(3, "At least 3 days")
    .max(42, "Keep it within 6 weeks"),
  goal: z.string().trim().optional(),
});

type EssayCoachFormValues = z.infer<typeof essayCoachSchema>;

const recallDrillSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  topic: z.string().min(3, "What topic should we drill?"),
  factsInput: z.string().min(10, "List the facts or steps to recall."),
  difficulty: z.enum(["gentle", "balanced", "intense"]),
});

type RecallDrillFormValues = z.infer<typeof recallDrillSchema>;

const mnemonicStyles: Array<{ label: string; value: MnemonicFormValues["preferredStyle"]; description: string }> = [
  { label: "Acrostic", value: "acrostic", description: "Use the first letters to form memorable phrases." },
  { label: "Story", value: "story", description: "Link facts into a vivid mini story." },
  { label: "Visual", value: "visual", description: "Create imagery and loci-based hooks." },
  { label: "Chunking", value: "chunking", description: "Group content into digestible clusters." },
  { label: "Rhythm", value: "rhythm", description: "Use rhyme or rhythm to increase recall." },
];

const difficultyLabels: Record<RecallDrillFormValues["difficulty"], string> = {
  gentle: "Gentle warm-up",
  balanced: "Balanced challenge",
  intense: "Intense mastery",
};

export function MemorisationModule() {
  const preferences = usePreferencesStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("mnemonics");
  const [mnemonicResult, setMnemonicResult] = useState<MnemonicResponse | null>(null);
  const [essayResult, setEssayResult] = useState<EssayCoachResponse | null>(null);
  const [recallResult, setRecallResult] = useState<RecallDrillResponse | null>(null);

  const [loadingMnemonic, setLoadingMnemonic] = useState(false);
  const [loadingEssay, setLoadingEssay] = useState(false);
  const [loadingRecall, setLoadingRecall] = useState(false);

  const mnemonicForm = useForm<MnemonicFormValues>({
    resolver: zodResolver(mnemonicSchema) as Resolver<MnemonicFormValues>,
    defaultValues: {
      subject: preferences.subject,
      focusArea: "",
      keyIdeas: "",
      preferredStyle: "acrostic",
    },
  });

  const essayForm = useForm<EssayCoachFormValues>({
    resolver: zodResolver(essayCoachSchema) as Resolver<EssayCoachFormValues>,
    defaultValues: {
      subject: preferences.subject,
      essayTitle: "",
      essayText: "",
      rehearsalWindowDays: 14,
      goal: "",
    },
  });

  const recallForm = useForm<RecallDrillFormValues>({
    resolver: zodResolver(recallDrillSchema) as Resolver<RecallDrillFormValues>,
    defaultValues: {
      subject: preferences.subject,
      topic: "",
      factsInput: "",
      difficulty: "balanced",
    },
  });

  const handleCopy = async (content: unknown, label: string) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      toast.error("Unable to copy content");
    }
  };

  const onSubmitMnemonics = mnemonicForm.handleSubmit(async (values) => {
    setLoadingMnemonic(true);
    try {
      preferences.update({ subject: values.subject, lastModule: "memorisation" });
      const response = await focuslyApi.generateMnemonics(values);
      setMnemonicResult(response);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Mnemonics generated and saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate mnemonics");
    } finally {
      setLoadingMnemonic(false);
    }
  });

  const onSubmitEssay = essayForm.handleSubmit(async (values) => {
    setLoadingEssay(true);
    try {
      preferences.update({ subject: values.subject, lastModule: "memorisation" });
      const response = await focuslyApi.coachEssayMemorisation(values);
      setEssayResult(response);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Essay rehearsal plan saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to coach essay memorisation");
    } finally {
      setLoadingEssay(false);
    }
  });

  const onSubmitRecall = recallForm.handleSubmit(async (values) => {
    setLoadingRecall(true);
    try {
      const facts = values.factsInput
        .split("\n")
        .map((fact) => fact.trim())
        .filter(Boolean);

      if (facts.length < 3) {
        toast.error("Add at least three facts to drill.");
        setLoadingRecall(false);
        return;
      }

      preferences.update({ subject: values.subject, lastModule: "memorisation" });
      const response = await focuslyApi.generateRecallDrills({
        subject: values.subject,
        topic: values.topic,
        facts,
        difficulty: values.difficulty,
      });
      setRecallResult(response);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Recall drills ready to use");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate drills");
    } finally {
      setLoadingRecall(false);
    }
  });

  const hasResults = useMemo(
    () => Boolean(mnemonicResult || essayResult || recallResult),
    [mnemonicResult, essayResult, recallResult]
  );

  return (
    <RequireAuth>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <Card className="border-primary/10 bg-gradient-to-br from-fuchsia-500/20 via-purple-200/25 to-indigo-500/20">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-semibold">Memorisation Studio</CardTitle>
            </div>
            <CardDescription className="text-base">
              Build mnemonics, rehearse essays, and drill active recall with personalised AI coaching.
            </CardDescription>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Multi-mode AI workflows</Badge>
              <Badge variant="outline">Designed for long-term retention</Badge>
              <Badge variant="outline">Saves outputs automatically</Badge>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full gap-2 md:grid-cols-3">
            <TabsTrigger value="mnemonics" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Mnemonics
            </TabsTrigger>
            <TabsTrigger value="essay" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Essay Coach
            </TabsTrigger>
            <TabsTrigger value="recall" className="gap-2">
              <Rocket className="h-4 w-4" />
              Recall Drills
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mnemonics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Mnemonic generator</CardTitle>
                <CardDescription>
                  Give us the facts you&apos;re trying to remember and choose the style that works for your brain.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...mnemonicForm}>
                  <form className="space-y-6" onSubmit={onSubmitMnemonics}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={mnemonicForm.control}
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
                        control={mnemonicForm.control}
                        name="focusArea"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Focus area (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g. Stages of mitosis" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={mnemonicForm.control}
                      name="preferredStyle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mnemonic style</FormLabel>
                          <div className="grid gap-3 md:grid-cols-2">
                            {mnemonicStyles.map((style) => {
                              const isActive = field.value === style.value;
                              return (
                                <button
                                  key={style.value}
                                  type="button"
                                  onClick={() => field.onChange(style.value)}
                                  className={cn(
                                    "rounded-lg border p-4 text-left transition",
                                    isActive
                                      ? "border-primary bg-primary/5 shadow-sm"
                                      : "border-muted-foreground/10 hover:border-primary/40"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold">{style.label}</span>
                                    {isActive ? <Badge>Selected</Badge> : null}
                                  </div>
                                  <p className="mt-2 text-sm text-muted-foreground">{style.description}</p>
                                </button>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mnemonicForm.control}
                      name="keyIdeas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key ideas</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={6}
                              placeholder="Paste the facts, sequences, or definitions you want to learn by heart."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-muted-foreground">
                        Tip: Add any specific acronyms, syllable counts, or imagery you already use so the AI can build around it.
                      </p>
                      <Button type="submit" disabled={loadingMnemonic} className="gap-2">
                        {loadingMnemonic ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {mnemonicResult ? (
              <Card className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Your mnemonic toolkit</CardTitle>
                    <CardDescription>
                      Three perspectives so you can choose the device that sticks best.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleCopy(mnemonicResult, "Mnemonic plan")}
                  >
                    <ClipboardCopy className="h-4 w-4" /> Copy JSON
                  </Button>
                </CardHeader>
                <CardContent>
                  <MnemonicResultView result={mnemonicResult} />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="essay" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Essay memorisation coach</CardTitle>
                <CardDescription>
                  Chunk your essay, extract cues, and receive a rehearsal schedule built around spaced repetition.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...essayForm}>
                  <form className="space-y-6" onSubmit={onSubmitEssay}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={essayForm.control}
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
                        control={essayForm.control}
                        name="rehearsalWindowDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rehearsal window (days)</FormLabel>
                            <FormControl>
                              <Input type="number" min={3} max={42} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={essayForm.control}
                      name="essayTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Essay title</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g. Power and control in Macbeth" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={essayForm.control}
                      name="goal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outcome focus (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g. Nail the introduction under 90 seconds" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={essayForm.control}
                      name="essayText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Essay draft or notes</FormLabel>
                          <FormControl>
                            <Textarea rows={10} placeholder="Paste your essay draft or detailed plan here." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-muted-foreground">
                        We&apos;ll break this into digestible rehearsals and capture memory cues and self-check prompts.
                      </p>
                      <Button type="submit" disabled={loadingEssay} className="gap-2">
                        {loadingEssay ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                        Coach me
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {essayResult ? (
              <Card className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Essay mastery plan</CardTitle>
                    <CardDescription>
                      Your breakdown, cues, and rehearsal calendar.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleCopy(essayResult, "Essay plan")}
                  >
                    <ClipboardCopy className="h-4 w-4" /> Copy JSON
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[600px] pr-4">
                    <EssayCoachResultView result={essayResult} />
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="recall" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Active recall drill builder</CardTitle>
                <CardDescription>
                  Turn lists of facts into escalating prompts with built-in reflection and spacing cues.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...recallForm}>
                  <form className="space-y-6" onSubmit={onSubmitRecall}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={recallForm.control}
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
                        control={recallForm.control}
                        name="difficulty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Difficulty ramp</FormLabel>
                            <FormControl>
                              <div className="grid gap-3 md:grid-cols-3">
                                {(Object.keys(difficultyLabels) as Array<RecallDrillFormValues["difficulty"]>).map((level) => {
                                  const isActive = field.value === level;
                                  return (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => field.onChange(level)}
                                      className={cn(
                                        "rounded-lg border p-3 text-left text-sm transition",
                                        isActive
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-muted-foreground/10 hover:border-primary/40"
                                      )}
                                    >
                                      <div className="font-semibold capitalize">{level}</div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {difficultyLabels[level]}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={recallForm.control}
                      name="topic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Topic focus</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g. Krebs cycle outputs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recallForm.control}
                      name="factsInput"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facts / steps</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={8}
                              placeholder="List each fact on a new line. Minimum three lines works best."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-muted-foreground">
                        We&apos;ll create prompts with hints and follow-up reflections to reinforce learning loops.
                      </p>
                      <Button type="submit" disabled={loadingRecall} className="gap-2">
                        {loadingRecall ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Build drills
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {recallResult ? (
              <Card className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Drill sequence ready</CardTitle>
                    <CardDescription>
                      Move through prompts daily and log confidence each round.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleCopy(recallResult, "Recall drills")}
                  >
                    <ClipboardCopy className="h-4 w-4" /> Copy JSON
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[600px] pr-4">
                    <RecallDrillResultView result={recallResult} />
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        </Tabs>

        {!hasResults && (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Sparkles className="h-10 w-10 text-primary" />
              <div className="space-y-2">
                <CardTitle className="text-xl">Ready to supercharge your memory?</CardTitle>
                <CardDescription>
                  Choose a tab above, add your study notes, and Focusly will save every output for future revision sessions.
                </CardDescription>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </RequireAuth>
  );
}
