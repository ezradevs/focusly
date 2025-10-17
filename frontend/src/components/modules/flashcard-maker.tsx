"use client";

import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  Check,
  Layers,
  Layers3,
  Loader2,
  Plus,
  Sparkles,
  StickyNote,
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Flashcard,
  FlashcardBuilderResponse,
  FlashcardDeck,
  FlashcardType,
  ImageMask,
  SubjectValue,
} from "@/types";
import { focuslyApi } from "@/lib/api";
import { usePreferencesStore } from "@/store/preferences";
import { useFlashcardStore } from "@/store/flashcards";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ImageOcclusionEditor } from "@/components/flashcards/image-occlusion-editor";
import { FlashcardStudyViewer } from "@/components/flashcards/flashcard-study-viewer";
import { SUBJECT_VALUES } from "@/constants/subjects";
import { formatSubject } from "@/lib/utils";
import { FlashcardSkeleton } from "@/components/loading/flashcard-skeleton";

const formSchema = z.object({
  subject: z.enum(SUBJECT_VALUES),
  sourceText: z.string().min(15, "Add some source content"),
  cardCount: z.coerce
    .number()
    .min(3, "At least 3 cards")
    .max(30, "Maximum 30 at a time"),
  includeTypes: z
    .array(z.enum(["basic", "cloze", "image-occlusion"]))
    .min(1, "Select at least one card type"),
});

const CARD_TYPE_LABELS: Record<FlashcardType, string> = {
  basic: "Basic Q&A",
  cloze: "Cloze deletion",
  "image-occlusion": "Image occlusion",
};

type FlashcardFormValues = z.infer<typeof formSchema>;

interface OcclusionState {
  [cardId: string]: {
    imageSrc?: string;
    masks: ImageMask[];
  };
}

export function FlashcardMakerModule() {
  const preferences = usePreferencesStore();
  const flashcardStore = useFlashcardStore();
  const [cards, setCards] = useState<FlashcardBuilderResponse["cards"]>([]);
  const [studyTips, setStudyTips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(
    flashcardStore.activeDeckId
  );
  const [newDeckName, setNewDeckName] = useState("");
  const [cardToSave, setCardToSave] = useState<FlashcardBuilderResponse["cards"][number] | null>(null);
  const [cardsToSave, setCardsToSave] = useState<FlashcardBuilderResponse["cards"]>([]);
  const [isBulkSave, setIsBulkSave] = useState(false);
  const [occlusionState, setOcclusionState] = useState<OcclusionState>({});
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);

  const form = useForm<FlashcardFormValues>({
    resolver: zodResolver(formSchema) as Resolver<FlashcardFormValues>,
    defaultValues: {
      subject: preferences.subject,
      sourceText: "",
      cardCount: 10,
      includeTypes: ["basic", "cloze", "image-occlusion"],
    },
  });

  const decks = flashcardStore.decks;

  const handleGenerate = form.handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      preferences.update({
        subject: values.subject,
        lastModule: "flashcards",
      });
      const response = await focuslyApi.buildFlashcards(values);
      setCards(response.cards);
      setStudyTips(response.studyTips ?? []);
      setOcclusionState({});
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Flashcard ideas ready");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to build flashcards"
      );
    } finally {
      setIsLoading(false);
    }
  });

  const openSaveDialog = (card: FlashcardBuilderResponse["cards"][number]) => {
    setCardToSave(card);
    setCardsToSave([]);
    setIsBulkSave(false);
    setDialogOpen(true);
  };

  const openBulkSaveDialog = () => {
    if (cards.length === 0) {
      toast.info("No cards to save");
      return;
    }
    setCardsToSave(cards);
    setCardToSave(null);
    setIsBulkSave(true);
    setDialogOpen(true);
  };

  const persistCard = () => {
    const cardsToProcess = isBulkSave ? cardsToSave : cardToSave ? [cardToSave] : [];

    if (cardsToProcess.length === 0) return;

    let deck: FlashcardDeck | undefined = decks.find(
      (candidate) => candidate.id === selectedDeckId
    );

    // If no existing deck selected and user entered a new name
    if (!deck && newDeckName.trim()) {
      deck = flashcardStore.createDeck({
        name: newDeckName.trim(),
        subject: form.getValues("subject"),
      });
      setSelectedDeckId(deck.id);
      setNewDeckName("");
    }

    // If still no deck, show error
    if (!deck) {
      toast.error("Select a deck or create a new one");
      return;
    }

    const flashcards: Flashcard[] = cardsToProcess.map((card) => {
      const occlusion = occlusionState[card.id];
      return {
        id: crypto.randomUUID(),
        deckId: deck.id,
        subject: form.getValues("subject"),
        type: card.type,
        front: card.front,
        back: card.back,
        clozeDeletion: card.clozeDeletion,
        imageGuidance:
          card.type === "image-occlusion"
            ? {
                prompt:
                  card.imageGuidance?.prompt ?? "Image occlusion card",
                occlusionIdeas: card.imageGuidance?.occlusionIdeas ?? [],
                imageSrc: occlusion?.imageSrc,
                masks: occlusion?.masks ?? [],
              }
            : undefined,
        tags: card.tags ?? [],
        createdAt: Date.now(),
      };
    });

    flashcardStore.addCards(deck.id, flashcards);
    flashcardStore.setActiveDeck(deck.id);
    setDialogOpen(false);
    setCardToSave(null);
    setCardsToSave([]);
    setIsBulkSave(false);

    toast.success(
      isBulkSave
        ? `Added ${flashcards.length} cards to ${deck.name}`
        : "Saved card to deck"
    );
  };

  const deckOptions = useMemo(
    () =>
      decks.map((deck) => ({
        label: `${deck.name} (${deck.cards.length} cards)`,
        value: deck.id,
      })),
    [decks]
  );

  const studyingDeck = studyingDeckId
    ? decks.find((d) => d.id === studyingDeckId)
    : null;

  if (studyingDeck && studyingDeck.cards.length > 0) {
    return (
      <RequireAuth>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-[calc(100vh-200px)]"
        >
          <FlashcardStudyViewer
            cards={studyingDeck.cards}
            deckName={studyingDeck.name}
            onClose={() => setStudyingDeckId(null)}
          />
        </motion.div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <Card className="border-primary/10 bg-gradient-to-br from-teal-400/20 via-cyan-200/20 to-cyan-500/20">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-semibold">Flashcard Maker</CardTitle>
            </div>
            <CardDescription className="text-base">
              Spin up spaced repetition decks with AI-powered templates for cloze, image occlusion, and classic Q&A cards.
            </CardDescription>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Smart card type mix</Badge>
              <Badge variant="outline">Deck + study viewer integration</Badge>
              <Badge variant="outline">Image occlusion ready</Badge>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form className="space-y-6" onSubmit={handleGenerate}>
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
                name="sourceText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source material</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={7}
                        placeholder="Provide textbook extracts, bullet points, or definitions to transform into cards..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cardCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of cards to generate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={3}
                        max={30}
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
                name="includeTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Include card types</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="multiple"
                        className="flex flex-wrap gap-2"
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value.length ? value : field.value)
                        }
                      >
                        {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
                          <ToggleGroupItem key={value} value={value} className="capitalize">
                            {label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Suggest flashcards
                    </>
                  )}
                </Button>
                <Badge variant="outline">{cards.length} suggestions</Badge>
              </div>
            </form>
          </Form>
          </CardContent>
        </Card>

        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-muted-foreground" />
                Suggested cards
              </CardTitle>
              <CardDescription>
                Review, edit, and save cards into decks. Image occlusion cards support an interactive mask editor.
              </CardDescription>
            </div>
            {cards.length > 0 && (
              <Button onClick={openBulkSaveDialog} variant="default">
                <Archive className="mr-2 h-4 w-4" />
                Add all to deck
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ScrollArea className="h-[560px] pr-4">
              <FlashcardSkeleton count={form.getValues("cardCount")} />
            </ScrollArea>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
              <StickyNote className="h-10 w-10 text-muted-foreground/60" />
              <p>Generate cards to preview them here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[560px] pr-4">
              <div className="space-y-4">
                {cards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border bg-background/70 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{CARD_TYPE_LABELS[card.type]}</Badge>
                        {card.tags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {card.tags.map((tag) => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openSaveDialog(card)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add to deck
                      </Button>
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-3 text-sm">
                      <MarkdownRenderer content={card.front} />
                      {card.type === "basic" && card.back && (
                        <div className="rounded-md bg-muted/40 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Answer</p>
                          <MarkdownRenderer content={card.back} />
                        </div>
                      )}
                      {card.type === "cloze" && card.clozeDeletion && (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Fill the gap</p>
                          <p className="font-medium">{card.clozeDeletion.fullText}</p>
                          <p className="text-sm text-muted-foreground">
                            Hidden text: {card.clozeDeletion.missingText}
                          </p>
                        </div>
                      )}
                      {card.type === "image-occlusion" && (
                        <ImageOcclusionEditor
                          imageSrc={occlusionState[card.id]?.imageSrc}
                          masks={occlusionState[card.id]?.masks ?? []}
                          onChange={(value) =>
                            setOcclusionState((prev) => ({
                              ...prev,
                              [card.id]: value,
                            }))
                          }
                        />
                      )}
                      {card.imageGuidance && card.imageGuidance.occlusionIdeas && (
                        <div className="rounded-md bg-muted/20 p-3 text-xs text-muted-foreground">
                          <p className="mb-2 font-semibold uppercase">AI suggestions</p>
                          <ul className="space-y-1">
                            {card.imageGuidance.occlusionIdeas.map((idea) => (
                              <li key={idea.label}>
                                <span className="font-medium">{idea.label}:</span> {idea.description}
                              </li>
                            ))}
                          </ul>
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

      {studyTips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Study tips</CardTitle>
            <CardDescription>AI suggestions to practise these cards effectively.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {studyTips.map((tip, index) => (
                <li key={index} className="flex gap-2">
                  <Check className="mt-1 h-4 w-4 text-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Local decks
          </CardTitle>
          <CardDescription>
            Decks are saved in your browser storage so you can keep studying even without regenerating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {decks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Save cards to create your first deck.
            </p>
          ) : (
            decks.map((deck) => (
              <div
                key={deck.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{deck.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {deck.cards.length} cards · {formatSubject(deck.subject)} · updated {new Date(deck.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setStudyingDeckId(deck.id)}
                  disabled={deck.cards.length === 0}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Study
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBulkSave ? `Add ${cardsToSave.length} cards to deck` : "Add flashcard to deck"}
            </DialogTitle>
            <DialogDescription>
              Save {isBulkSave ? "all cards" : "this card"} to an existing deck or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {deckOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Existing decks</p>
                <div className="grid gap-2">
                  {deckOptions.map((deck) => (
                    <button
                      key={deck.value}
                      onClick={() => {
                        setSelectedDeckId(deck.value);
                        setNewDeckName("");
                      }}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                        selectedDeckId === deck.value && !newDeckName
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary/60"
                      }`}
                    >
                      {deck.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Create new deck</p>
              <Input
                placeholder="Deck name"
                value={newDeckName}
                onChange={(event) => {
                  setNewDeckName(event.target.value);
                  if (event.target.value) {
                    setSelectedDeckId(undefined);
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={persistCard}>
              {isBulkSave ? `Save ${cardsToSave.length} cards` : "Save card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
    </RequireAuth>
  );
}
