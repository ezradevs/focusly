"use client";

import { Layers, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FlashcardDeckData {
  cards: Array<{
    id: string;
    type: "basic" | "cloze" | "image-occlusion";
    front?: string;
    back?: string;
    clozeDeletion?: {
      fullText: string;
      missingText: string;
    } | null;
    imageGuidance?: {
      prompt: string;
      occlusionIdeas: Array<{
        label: string;
        description: string;
      }>;
    } | null;
    tags?: string[];
  }>;
  studyTips?: string[];
}

interface FlashcardDeckViewerProps {
  data: FlashcardDeckData;
}

const CARD_TYPE_LABELS: Record<string, string> = {
  basic: "Basic Q&A",
  cloze: "Cloze Deletion",
  "image-occlusion": "Image Occlusion",
};

export function FlashcardDeckViewer({ data }: FlashcardDeckViewerProps) {
  if (!data.cards || data.cards.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No flashcards available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Flashcard Deck</h3>
        <Badge variant="outline">{data.cards.length} Cards</Badge>
      </div>

      {/* Flashcards */}
      <div className="space-y-3">
        {data.cards.map((card, index) => (
          <Card key={card.id || index} className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Card {index + 1}</span>
                  <Badge variant="secondary" className="text-xs">
                    {CARD_TYPE_LABELS[card.type]}
                  </Badge>
                </div>
                {card.tags && card.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {card.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {card.type === "basic" && (
                <Tabs defaultValue="front" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="front">Front</TabsTrigger>
                    <TabsTrigger value="back">Back</TabsTrigger>
                  </TabsList>
                  <TabsContent value="front" className="mt-4 rounded-lg border bg-muted/20 p-4">
                    <MarkdownRenderer content={card.front || ""} />
                  </TabsContent>
                  <TabsContent value="back" className="mt-4 rounded-lg border bg-primary/5 p-4">
                    <MarkdownRenderer content={card.back || ""} />
                  </TabsContent>
                </Tabs>
              )}

              {card.type === "cloze" && card.clozeDeletion && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Complete Text
                    </p>
                    <p className="font-medium">{card.clozeDeletion.fullText}</p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
                    <p className="mb-1 text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                      Hidden Text
                    </p>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      {card.clozeDeletion.missingText}
                    </p>
                  </div>
                </div>
              )}

              {card.type === "image-occlusion" && card.imageGuidance && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="mb-2 text-sm font-semibold">Image Prompt</p>
                    <p className="text-sm text-muted-foreground">{card.imageGuidance.prompt}</p>
                  </div>
                  {card.imageGuidance.occlusionIdeas && card.imageGuidance.occlusionIdeas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Occlusion Ideas</p>
                      {card.imageGuidance.occlusionIdeas.map((idea, i) => (
                        <div key={i} className="rounded-lg border bg-background p-3">
                          <p className="font-medium text-primary">{idea.label}</p>
                          <p className="text-sm text-muted-foreground">{idea.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Study Tips */}
      {data.studyTips && data.studyTips.length > 0 && (
        <Card className="border-l-4 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Study Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.studyTips.map((tip, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
