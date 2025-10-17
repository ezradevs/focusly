"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import { focuslyApi } from "@/lib/api";
import type { ChatMessage, SubjectValue } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePreferencesStore } from "@/store/preferences";
import { SubjectSelect } from "@/components/subject-select";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";

interface TutorChatbotProps {
  className?: string;
}

const initialAssistantMessage: ChatMessage = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "Hi! I'm your Focusly tutor. Ask me anything about your subject and I'll walk you through it.",
  createdAt: Date.now(),
};

export function TutorChatbot({ className }: TutorChatbotProps) {
  const subject = usePreferencesStore((state) => state.subject);
  const updatePreferences = usePreferencesStore((state) => state.update);
  const status = useAuthStore((state) => state.status);
  const setAuthDialogOpen = useUIStore((state) => state.setAuthDialogOpen);
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([initialAssistantMessage]);
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleSubjectChange = (newSubject: SubjectValue) => {
    updatePreferences({ subject: newSubject });
  };

  const tutorMutation = useMutation({
    mutationFn: async (payload: { conversation: ChatMessage[] }) => {
      const historyPayload = payload.conversation.map(({ role, content }) => ({
        role,
        content,
      }));

      return focuslyApi.tutorChat({
        subject,
        messages: historyPayload,
      });
    },
    onSuccess: (response, variables) => {
      const now = Date.now();
      setMessages([
        ...variables.conversation,
        {
          id: `assistant-${now}`,
          role: "assistant",
          content: response.reply,
          createdAt: now,
        },
      ]);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Unable to reach tutor");
    },
  });

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleOpen = () => {
    if (status !== "authenticated") {
      toast.error("Please sign in to use the AI tutor");
      setAuthDialogOpen(true);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "authenticated") {
      toast.error("Please sign in to use the AI tutor");
      setAuthDialogOpen(true);
      return;
    }
    if (!input.trim()) {
      toast.info("Enter a question for the tutor");
      return;
    }
    const prompt = input.trim();
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `user-${now}`,
      role: "user",
      content: prompt,
      createdAt: now,
    };

    const nextConversation = [...messages.filter(Boolean), userMessage];
    setMessages(nextConversation);
    setInput("");
    tutorMutation.mutate({ conversation: nextConversation });
  };

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div
            key="chatbot-trigger"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              onClick={handleOpen}
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="chatbot-panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mb-3 w-[320px] sm:w-[380px]"
          >
            <Card className="shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold">Focusly Tutor</p>
                  <div className="w-full">
                    <SubjectSelect
                      value={subject}
                      onChange={handleSubjectChange}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 shrink-0 mt-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-4 py-3">
                <ScrollArea className="h-[480px]" ref={scrollRef}>
                  <div className="space-y-3 pr-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-3 py-2 text-sm shadow-sm",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                    {message.role === "assistant" && (
                      <div className="mb-1 flex items-center gap-1 text-xs font-medium">
                        <Sparkles className="h-3 w-3 text-primary" />
                        Focusly Tutor
                      </div>
                    )}
                          <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {tutorMutation.isPending && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground shadow-sm">
                          Thinking…
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <form onSubmit={handleSubmit} className="border-t px-4 py-3">
                <div className="relative">
                  <Textarea
                    placeholder="Ask a question or paste a tricky concept…"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    className="min-h-[70px] resize-none pr-10"
                    disabled={tutorMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="absolute bottom-2 right-2 h-8 w-8"
                    disabled={tutorMutation.isPending}
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
