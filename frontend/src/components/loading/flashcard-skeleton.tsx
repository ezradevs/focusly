import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface FlashcardSkeletonProps {
  count?: number;
}

export function FlashcardSkeleton({ count = 10 }: FlashcardSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border bg-background/70 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" /> {/* Type badge */}
              <Skeleton className="h-5 w-20" /> {/* Tag */}
            </div>
            <Skeleton className="h-9 w-28" /> {/* Add to deck button */}
          </div>

          <Separator className="my-3" />

          <div className="space-y-3">
            {/* Front of card */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Back/Answer section */}
            {index % 2 === 0 && (
              <div className="rounded-md bg-muted/40 p-3 space-y-2">
                <Skeleton className="h-3 w-16" /> {/* "Answer" label */}
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            )}

            {/* Cloze deletion variant */}
            {index % 3 === 0 && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <Skeleton className="h-3 w-20" /> {/* "Fill the gap" label */}
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" /> {/* Hidden text */}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
