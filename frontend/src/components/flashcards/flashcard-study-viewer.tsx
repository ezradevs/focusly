"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shuffle,
  X,
  RotateCw,
  Trophy,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { Flashcard } from "@/types";

interface FlashcardStudyViewerProps {
  cards: Flashcard[];
  deckName: string;
  onClose: () => void;
}

export function FlashcardStudyViewer({
  cards,
  deckName,
  onClose,
}: FlashcardStudyViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [difficultCards, setDifficultCards] = useState<Set<string>>(new Set());
  const [studyOrder, setStudyOrder] = useState<number[]>(
    cards.map((_, i) => i)
  );

  const currentCard = cards[studyOrder[currentIndex]];
  const progress = ((currentIndex + 1) / studyOrder.length) * 100;

  const handleNext = () => {
    if (currentIndex < studyOrder.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const toggleKnown = () => {
    const newSet = new Set(knownCards);
    if (newSet.has(currentCard.id)) {
      newSet.delete(currentCard.id);
    } else {
      newSet.add(currentCard.id);
      difficultCards.delete(currentCard.id);
    }
    setKnownCards(newSet);
  };

  const toggleDifficult = () => {
    const newSet = new Set(difficultCards);
    if (newSet.has(currentCard.id)) {
      newSet.delete(currentCard.id);
    } else {
      newSet.add(currentCard.id);
      knownCards.delete(currentCard.id);
    }
    setDifficultCards(newSet);
  };

  const handleShuffle = () => {
    const shuffled = [...studyOrder].sort(() => Math.random() - 0.5);
    setStudyOrder(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setDifficultCards(new Set());
  };

  const stats = useMemo(() => {
    const known = knownCards.size;
    const difficult = difficultCards.size;
    const remaining = cards.length - known - difficult;
    return { known, difficult, remaining };
  }, [knownCards, difficultCards, cards.length]);

  if (!currentCard) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No cards to study</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{deckName}</h2>
          <p className="text-sm text-muted-foreground">
            Card {currentIndex + 1} of {studyOrder.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="mr-2 h-4 w-4" />
            Shuffle
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>{stats.known} known</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-amber-600" />
            <span>{stats.difficult} difficult</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-muted-foreground" />
            <span>{stats.remaining} remaining</span>
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          className="relative h-[400px] w-full max-w-2xl cursor-pointer"
          onClick={handleFlip}
          animate={{ scale: isFlipped ? [1, 0.95, 1] : 1 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isFlipped ? "back" : "front"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <Card
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center p-8 text-center shadow-xl",
                  knownCards.has(currentCard.id) && "border-green-500 bg-green-50 dark:bg-green-950/20",
                  difficultCards.has(currentCard.id) && "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary">{currentCard.type}</Badge>
                  {currentCard.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="max-w-xl text-lg">
                  {!isFlipped ? (
                    <>
                      {currentCard.type === "basic" && (
                        <MarkdownRenderer content={currentCard.front || ""} />
                      )}
                      {currentCard.type === "cloze" && currentCard.clozeDeletion && (
                        <div className="space-y-2">
                          <p className="font-medium">
                            {currentCard.clozeDeletion.fullText.replace(
                              currentCard.clozeDeletion.missingText,
                              "[...]"
                            )}
                          </p>
                        </div>
                      )}
                      {currentCard.type === "image-occlusion" && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {currentCard.imageGuidance?.prompt}
                          </p>
                          {currentCard.imageGuidance?.imageSrc && (
                            <img
                              src={currentCard.imageGuidance.imageSrc}
                              alt="Flashcard"
                              className="mx-auto max-h-60 rounded-lg"
                            />
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {currentCard.type === "basic" && (
                        <div className="space-y-3">
                          <div className="rounded-lg bg-muted/50 p-4 text-left">
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                              Question
                            </p>
                            <MarkdownRenderer content={currentCard.front || ""} />
                          </div>
                          <div className="rounded-lg bg-primary/10 p-4 text-left">
                            <p className="mb-2 text-xs font-semibold uppercase text-primary">
                              Answer
                            </p>
                            <MarkdownRenderer content={currentCard.back || ""} />
                          </div>
                        </div>
                      )}
                      {currentCard.type === "cloze" && currentCard.clozeDeletion && (
                        <div className="space-y-3">
                          <div className="rounded-lg bg-muted/50 p-4">
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                              Complete Text
                            </p>
                            <p className="font-medium">{currentCard.clozeDeletion.fullText}</p>
                          </div>
                          <div className="rounded-lg bg-primary/10 p-4">
                            <p className="mb-2 text-xs font-semibold uppercase text-primary">
                              Hidden Text
                            </p>
                            <p className="font-semibold text-primary">
                              {currentCard.clozeDeletion.missingText}
                            </p>
                          </div>
                        </div>
                      )}
                      {currentCard.type === "image-occlusion" && (
                        <div className="space-y-2">
                          <p className="text-sm">Check the revealed areas on the image</p>
                          {currentCard.imageGuidance?.imageSrc && (
                            <img
                              src={currentCard.imageGuidance.imageSrc}
                              alt="Flashcard answer"
                              className="mx-auto max-h-60 rounded-lg"
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <p className="mt-6 text-sm text-muted-foreground">
                  Click to flip
                </p>
              </Card>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={knownCards.has(currentCard.id) ? "default" : "outline"}
            size="sm"
            onClick={toggleKnown}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {knownCards.has(currentCard.id) ? "Known" : "Mark as known"}
          </Button>
          <Button
            variant={difficultCards.has(currentCard.id) ? "default" : "outline"}
            size="sm"
            onClick={toggleDifficult}
          >
            <Target className="mr-2 h-4 w-4" />
            {difficultCards.has(currentCard.id) ? "Difficult" : "Mark as difficult"}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentIndex === studyOrder.length - 1}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
