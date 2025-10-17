"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchingPair {
  left: string;
  right: string;
}

interface MatchingQuestionProps {
  pairs: MatchingPair[];
  onMatchChange: (matches: Record<number, number>) => void;
  initialMatches?: Record<number, number>;
}

interface DraggableItemProps {
  id: string;
  index: number;
  content: string;
  isMatched: boolean;
}

function DraggableItem({ id, index, content, isMatched }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 p-3 rounded-lg border bg-card
        ${isMatched ? 'opacity-50 border-dashed' : 'cursor-grab active:cursor-grabbing hover:bg-muted/50'}
        ${isDragging ? 'z-50' : ''}
      `}
    >
      <div {...listeners} {...attributes} className="flex items-center gap-2 flex-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="font-mono">
          {String.fromCharCode(65 + index)}
        </Badge>
        <span>{content}</span>
      </div>
    </div>
  );
}

interface DropZoneProps {
  leftIndex: number;
  leftContent: string;
  rightIndex: number | null;
  rightContent: string | null;
  onRemove: () => void;
}

function DropZone({ leftIndex, leftContent, rightIndex, rightContent, onRemove }: DropZoneProps) {
  const { setNodeRef, isOver } = useSortable({
    id: `drop-${leftIndex}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center gap-3 p-4 rounded-lg border-2 border-dashed transition-colors
        ${isOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'}
        ${rightContent ? 'bg-green-50 dark:bg-green-950 border-green-500' : 'bg-muted/30'}
      `}
    >
      <div className="flex items-center gap-2 flex-1">
        <Badge className="font-mono bg-blue-500">{leftIndex + 1}</Badge>
        <span className="font-medium">{leftContent}</span>
      </div>

      {rightContent !== null && rightIndex !== null ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {String.fromCharCode(65 + rightIndex)}
          </Badge>
          <span className="text-sm">{rightContent}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground italic">Drop here to match</span>
      )}
    </div>
  );
}

export function MatchingQuestion({ pairs, onMatchChange, initialMatches = {} }: MatchingQuestionProps) {
  const [matches, setMatches] = useState<Record<number, number>>(initialMatches);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Track which right items are already matched
  const matchedRightIndices = new Set(Object.values(matches));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if dropping over a drop zone
    const overId = over.id as string;
    if (overId.startsWith('drop-')) {
      const leftIndex = parseInt(overId.replace('drop-', ''));
      const rightIndex = parseInt(active.id as string);

      // Update matches
      const newMatches = { ...matches };

      // Remove any existing match for this left item
      delete newMatches[leftIndex];

      // Remove this right item from any other left items
      Object.keys(newMatches).forEach(key => {
        if (newMatches[parseInt(key)] === rightIndex) {
          delete newMatches[parseInt(key)];
        }
      });

      // Add new match
      newMatches[leftIndex] = rightIndex;

      setMatches(newMatches);
      onMatchChange(newMatches);
    }
  };

  const handleRemoveMatch = (leftIndex: number) => {
    const newMatches = { ...matches };
    delete newMatches[leftIndex];
    setMatches(newMatches);
    onMatchChange(newMatches);
  };

  const activeItem = activeId !== null ? pairs[parseInt(activeId)] : null;

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Drop Zones (Left Column) */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Match the items:</h4>
          <SortableContext
            items={pairs.map((_, idx) => `drop-${idx}`)}
            strategy={verticalListSortingStrategy}
          >
            {pairs.map((pair, leftIdx) => (
              <DropZone
                key={leftIdx}
                leftIndex={leftIdx}
                leftContent={pair.left}
                rightIndex={matches[leftIdx] ?? null}
                rightContent={matches[leftIdx] !== undefined ? pairs[matches[leftIdx]].right : null}
                onRemove={() => handleRemoveMatch(leftIdx)}
              />
            ))}
          </SortableContext>
        </div>

        {/* Draggable Items (Right Column) */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Drag items from here:</h4>
          <SortableContext
            items={pairs.map((_, idx) => idx.toString())}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {pairs.map((pair, idx) => (
                <DraggableItem
                  key={idx}
                  id={idx.toString()}
                  index={idx}
                  content={pair.right}
                  isMatched={matchedRightIndices.has(idx)}
                />
              ))}
            </div>
          </SortableContext>
        </Card>

        <DragOverlay>
          {activeItem ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-card shadow-lg">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="font-mono">
                {String.fromCharCode(65 + parseInt(activeId!))}
              </Badge>
              <span>{activeItem.right}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Match Summary */}
      {Object.keys(matches).length > 0 && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Your Matches ({Object.keys(matches).length}/{pairs.length}):
          </h4>
          <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
            {Object.entries(matches)
              .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
              .map(([leftIdx, rightIdx]) => (
                <div key={leftIdx} className="font-mono">
                  {parseInt(leftIdx) + 1} → {String.fromCharCode(65 + rightIdx)}
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
