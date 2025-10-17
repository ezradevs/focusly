"use client";

import { useCallback, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Languages,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  PenTool,
  ArrowRightLeft,
  Loader2,
  Volume2,
  Send,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { focuslyApi } from "@/lib/api";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formSchema = z.object({
  language: z.string().min(1, "Please enter a language"),
  practiceMode: z.enum(["vocabulary", "grammar", "conversation", "writing", "translation"]),
  content: z.string().min(1, "Please provide content"),
  proficiencyLevel: z.enum(["beginner", "intermediate", "advanced"]),
  context: z.string().optional(),
});

type LanguageFormValues = z.infer<typeof formSchema>;

type LanguageResult =
  | {
      mode: "vocabulary";
      words: Array<{
        word: string;
        translation: string;
        pronunciation?: string;
        partOfSpeech: string;
        exampleSentence: string;
        usageTips: string[];
      }>;
    }
  | {
      mode: "grammar";
      corrections: Array<{
        original: string;
        corrected: string;
        explanation: string;
        rule: string;
      }>;
      summary: string;
    }
  | {
      mode: "conversation";
      dialogue: Array<{
        speaker: string;
        text: string;
        translation?: string;
      }>;
      vocabulary: string[];
      culturalNotes?: string[];
    }
  | {
      mode: "writing";
      prompt: string;
      feedback?: {
        grammar: string[];
        vocabulary: string[];
        structure: string[];
        overallScore: number;
      };
      improvements: string[];
    }
  | {
      mode: "translation";
      originalText: string;
      translatedText: string;
      alternativeTranslations?: string[];
      explanations: Array<{
        phrase: string;
        explanation: string;
      }>;
    };

const POPULAR_LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Russian",
  "Hindi",
];

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  translation?: string;
  feedback?: {
    grammarNotes: string[];
    vocabularySuggestions: string[];
    culturalTips?: string[];
  };
}

export function LanguagePracticeModule() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<LanguageResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Interactive conversation state
  const [conversationMode, setConversationMode] = useState<"generate" | "live">("generate");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showTranslations, setShowTranslations] = useState(true);
  const [conversationScenario, setConversationScenario] = useState("");

  const form = useForm<LanguageFormValues>({
    resolver: zodResolver(formSchema) as Resolver<LanguageFormValues>,
    defaultValues: {
      language: "",
      practiceMode: "vocabulary",
      content: "",
      proficiencyLevel: "intermediate",
      context: "",
    },
  });

  const practiceMode = form.watch("practiceMode");

  const onSubmit = form.handleSubmit(async (values) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await focuslyApi.practiceLanguage(values);
      setResult(response.result as LanguageResult);
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Practice session generated!");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to generate practice session";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  });

  const getModeIcon = useCallback((mode: string) => {
    switch (mode) {
      case "vocabulary":
        return <BookOpen className="h-5 w-5" />;
      case "grammar":
        return <CheckCircle2 className="h-5 w-5" />;
      case "conversation":
        return <MessageSquare className="h-5 w-5" />;
      case "writing":
        return <PenTool className="h-5 w-5" />;
      case "translation":
        return <ArrowRightLeft className="h-5 w-5" />;
      default:
        return <Languages className="h-5 w-5" />;
    }
  }, []);

  const getModeDescription = useCallback((mode: string) => {
    switch (mode) {
      case "vocabulary":
        return "Enter words or topics to learn vocabulary with examples and usage tips";
      case "grammar":
        return "Paste text to check grammar and get detailed corrections";
      case "conversation":
        return conversationMode === "live"
          ? "Have a real-time conversation with AI in your target language"
          : "Describe a scenario to generate a conversation";
      case "writing":
        return "Enter a topic for a writing prompt, or paste your writing for feedback";
      case "translation":
        return "Enter text to translate with detailed explanations";
      default:
        return "";
    }
  }, [conversationMode]);

  const handleSendMessage = useCallback(async () => {
    if (!userMessage.trim() || !form.getValues("language")) return;

    const newUserMessage: ConversationMessage = {
      role: "user",
      content: userMessage.trim(),
    };

    setConversationMessages((prev) => [...prev, newUserMessage]);
    setUserMessage("");
    setIsSendingMessage(true);

    try {
      const response = await focuslyApi.languageConversation({
        language: form.getValues("language"),
        proficiencyLevel: form.getValues("proficiencyLevel"),
        scenario: conversationScenario || undefined,
        messages: [
          ...conversationMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: newUserMessage.content },
        ],
      });

      const aiMessage: ConversationMessage = {
        role: "assistant",
        content: response.message,
        translation: response.translation,
        feedback: response.feedback,
      };

      setConversationMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  }, [userMessage, form, conversationScenario, conversationMessages]);

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
            <Languages className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-semibold">
              Language Practice Hub
            </CardTitle>
          </div>
          <CardDescription>
            Practice vocabulary, grammar, conversation, writing, and translation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Language and Level Selection */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            placeholder="e.g., Spanish, French, Japanese..."
                            {...field}
                          />
                          <div className="flex flex-wrap gap-2">
                            {POPULAR_LANGUAGES.slice(0, 6).map((lang) => (
                              <Badge
                                key={lang}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => field.onChange(lang)}
                              >
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proficiencyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proficiency Level</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Practice Mode Selection */}
              <FormField
                control={form.control}
                name="practiceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Practice Mode</FormLabel>
                    <FormControl>
                      <Tabs value={field.value} onValueChange={field.onChange}>
                        <TabsList className="grid w-full grid-cols-5">
                          <TabsTrigger value="vocabulary">
                            <BookOpen className="mr-1 h-4 w-4" />
                            Vocabulary
                          </TabsTrigger>
                          <TabsTrigger value="grammar">
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Grammar
                          </TabsTrigger>
                          <TabsTrigger value="conversation">
                            <MessageSquare className="mr-1 h-4 w-4" />
                            Conversation
                          </TabsTrigger>
                          <TabsTrigger value="writing">
                            <PenTool className="mr-1 h-4 w-4" />
                            Writing
                          </TabsTrigger>
                          <TabsTrigger value="translation">
                            <ArrowRightLeft className="mr-1 h-4 w-4" />
                            Translation
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </FormControl>
                    <FormDescription>{getModeDescription(field.value)}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conversation Mode Toggle */}
              {practiceMode === "conversation" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={conversationMode === "generate" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConversationMode("generate")}
                    className="flex-1"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Dialogue
                  </Button>
                  <Button
                    type="button"
                    variant={conversationMode === "live" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setConversationMode("live");
                      setConversationMessages([]);
                    }}
                    className="flex-1"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Live Chat
                  </Button>
                </div>
              )}

              {/* Show form fields only when not in live chat mode */}
              {!(practiceMode === "conversation" && conversationMode === "live") && (
                <>
                  {/* Content Input */}
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {practiceMode === "vocabulary"
                            ? "Words or Topics"
                            : practiceMode === "grammar"
                            ? "Text to Check"
                            : practiceMode === "conversation"
                            ? "Scenario"
                            : practiceMode === "writing"
                            ? "Topic or Your Writing"
                            : "Text to Translate"}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            rows={6}
                            placeholder={
                              practiceMode === "vocabulary"
                                ? "e.g., Food vocabulary, travel phrases..."
                                : practiceMode === "grammar"
                                ? "Paste your text here for grammar checking..."
                                : practiceMode === "conversation"
                                ? "e.g., Ordering at a restaurant, meeting someone new..."
                                : practiceMode === "writing"
                                ? "Enter a topic or paste your writing for feedback..."
                                : "Enter text to translate..."
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Context (optional for conversation) */}
                  {practiceMode === "conversation" && (
                    <FormField
                      control={form.control}
                      name="context"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Context (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., formal setting, casual with friends..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        {getModeIcon(practiceMode)}
                        Start Practice
                      </>
                    )}
                  </Button>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Interactive Conversation Chat */}
      {practiceMode === "conversation" && conversationMode === "live" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Live Conversation
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranslations(!showTranslations)}
                >
                  {showTranslations ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  <span className="ml-2 text-xs">
                    {showTranslations ? "Hide" : "Show"} Translations
                  </span>
                </Button>
                {conversationMessages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConversationMessages([])}
                  >
                    Clear Chat
                  </Button>
                )}
              </div>
            </div>
            {conversationMessages.length === 0 && (
              <CardDescription>
                Start practicing by typing a message in {form.watch("language") || "your target language"}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {/* Scenario Input */}
            {conversationMessages.length === 0 && (
              <div className="mb-4 space-y-2">
                <label className="text-sm font-medium">
                  Conversation Scenario (Optional)
                </label>
                <Input
                  placeholder="e.g., At a restaurant, meeting a friend, job interview..."
                  value={conversationScenario}
                  onChange={(e) => setConversationScenario(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Set a scenario to guide the conversation context
                </p>
              </div>
            )}

            {/* Chat Messages */}
            <div className="mb-4 space-y-3 rounded-lg border bg-muted/20 p-4" style={{ minHeight: "400px", maxHeight: "500px", overflowY: "auto" }}>
              {conversationMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                  <MessageSquare className="mb-3 h-12 w-12 opacity-50" />
                  <p className="text-sm">Your conversation will appear here</p>
                  <p className="text-xs">Type a message below to begin</p>
                </div>
              ) : (
                conversationMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] space-y-2 rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      }`}
                    >
                      <p className="font-medium">{msg.content}</p>
                      {showTranslations && msg.translation && (
                        <p className={`text-sm ${msg.role === "user" ? "opacity-80" : "text-muted-foreground"}`}>
                          {msg.translation}
                        </p>
                      )}
                      {msg.feedback && (
                        <div className="mt-2 space-y-1 border-t pt-2 text-xs">
                          {msg.feedback.grammarNotes.length > 0 && (
                            <div>
                              <p className="font-semibold">Grammar:</p>
                              {msg.feedback.grammarNotes.map((note, i) => (
                                <p key={i} className="opacity-90">• {note}</p>
                              ))}
                            </div>
                          )}
                          {msg.feedback.vocabularySuggestions.length > 0 && (
                            <div>
                              <p className="font-semibold">Vocabulary:</p>
                              {msg.feedback.vocabularySuggestions.map((note, i) => (
                                <p key={i} className="opacity-90">• {note}</p>
                              ))}
                            </div>
                          )}
                          {msg.feedback.culturalTips && msg.feedback.culturalTips.length > 0 && (
                            <div>
                              <p className="font-semibold">Cultural Tip:</p>
                              {msg.feedback.culturalTips.map((note, i) => (
                                <p key={i} className="opacity-90">• {note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              {isSendingMessage && (
                <div className="flex justify-start">
                  <div className="rounded-lg border bg-card p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                disabled={isSendingMessage || !form.watch("language")}
              />
              <Button
                onClick={() => void handleSendMessage()}
                disabled={isSendingMessage || !userMessage.trim() || !form.watch("language")}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!form.watch("language") && (
              <p className="mt-2 text-xs text-muted-foreground">
                Please select a language above to start chatting
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getModeIcon(result.mode)}
              {result.mode.charAt(0).toUpperCase() + result.mode.slice(1)} Practice
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.mode === "vocabulary" && (
              <div className="space-y-4">
                {result.words.map((word, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">{word.word}</h3>
                        {word.pronunciation && (
                          <p className="text-sm text-muted-foreground">
                            {word.pronunciation}
                          </p>
                        )}
                      </div>
                      <Badge>{word.partOfSpeech}</Badge>
                    </div>
                    <p className="mb-2 text-lg">{word.translation}</p>
                    <div className="mb-2 rounded-md bg-muted/50 p-3 italic">
                      {word.exampleSentence}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Usage Tips:</p>
                      {word.usageTips.map((tip, i) => (
                        <p key={i} className="text-sm text-muted-foreground">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {result.mode === "grammar" && (
              <div className="space-y-4">
                <div className="rounded-lg border-l-4 border-primary bg-primary/10 p-4">
                  <p className="font-semibold">Overall Assessment:</p>
                  <p>{result.summary}</p>
                </div>
                {result.corrections.map((correction, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-2 rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground line-through">
                        {correction.original}
                      </p>
                      <p className="font-semibold text-green-600">
                        {correction.corrected}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                      <p className="mb-1 font-semibold">Explanation:</p>
                      <p>{correction.explanation}</p>
                    </div>
                    <Badge variant="outline">{correction.rule}</Badge>
                  </motion.div>
                ))}
              </div>
            )}

            {result.mode === "conversation" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {result.dialogue.map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.15 }}
                      className={`flex ${
                        index % 2 === 0 ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] space-y-1 rounded-lg p-4 ${
                          index % 2 === 0
                            ? "bg-muted/50"
                            : "bg-primary/10"
                        }`}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">
                          {line.speaker}
                        </p>
                        <p className="font-medium">{line.text}</p>
                        {line.translation && (
                          <p className="text-sm text-muted-foreground">
                            {line.translation}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="mb-2 font-semibold">Key Vocabulary:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.vocabulary.map((word, i) => (
                      <Badge key={i} variant="secondary">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
                {result.culturalNotes && result.culturalNotes.length > 0 && (
                  <div className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4 dark:bg-purple-950">
                    <p className="mb-2 font-semibold">Cultural Notes:</p>
                    {result.culturalNotes.map((note, i) => (
                      <p key={i} className="text-sm">
                        • {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.mode === "writing" && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="mb-2 font-semibold">Writing Prompt:</p>
                  <p>{result.prompt}</p>
                </div>
                {result.feedback && (
                  <div className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-lg font-semibold">Your Score</p>
                      <div className="flex items-center gap-2">
                        <div className="text-3xl font-bold text-primary">
                          {result.feedback.overallScore}
                        </div>
                        <span className="text-muted-foreground">/100</span>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="mb-2 text-sm font-semibold">Grammar:</p>
                        {result.feedback.grammar.map((point, i) => (
                          <p key={i} className="text-sm">
                            • {point}
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold">Vocabulary:</p>
                        {result.feedback.vocabulary.map((point, i) => (
                          <p key={i} className="text-sm">
                            • {point}
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold">Structure:</p>
                        {result.feedback.structure.map((point, i) => (
                          <p key={i} className="text-sm">
                            • {point}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border p-4">
                  <p className="mb-2 font-semibold">Suggestions for Improvement:</p>
                  {result.improvements.map((improvement, i) => (
                    <p key={i} className="mb-1 text-sm">
                      • {improvement}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {result.mode === "translation" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">
                      Original
                    </p>
                    <p>{result.originalText}</p>
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-4">
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">
                      Translation
                    </p>
                    <p className="font-medium">{result.translatedText}</p>
                  </div>
                </div>
                {result.alternativeTranslations &&
                  result.alternativeTranslations.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <p className="mb-2 font-semibold">Alternative Translations:</p>
                      {result.alternativeTranslations.map((alt, i) => (
                        <p key={i} className="text-sm">
                          {i + 1}. {alt}
                        </p>
                      ))}
                    </div>
                  )}
                <div className="space-y-3">
                  <p className="font-semibold">Detailed Explanations:</p>
                  {result.explanations.map((exp, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="rounded-lg border p-4"
                    >
                      <p className="mb-2 font-medium text-primary">{exp.phrase}</p>
                      <p className="text-sm">{exp.explanation}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
    </RequireAuth>
  );
}
