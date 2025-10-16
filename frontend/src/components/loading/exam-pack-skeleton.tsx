import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ExamPackSkeletonProps {
  count?: number;
}

export function ExamPackSkeleton({ count = 3 }: ExamPackSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border">
          {/* Accordion trigger skeleton */}
          <div className="flex items-center justify-between px-3 py-4">
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" /> {/* "Question 1" */}
              <Skeleton className="h-3 w-32" /> {/* "5 marking points" */}
            </div>
            <Skeleton className="h-4 w-4" /> {/* Chevron icon */}
          </div>

          {/* Expanded content skeleton (show for first item) */}
          {index === 0 && (
            <div className="border-t px-4 pb-4 pt-2 space-y-4">
              {/* Prompt */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" /> {/* "PROMPT" label */}
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>

              {/* Marking criteria */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" /> {/* "MARKING CRITERIA" */}
                <div className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>

              {/* Band 6 sample */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Skeleton className="h-3 w-32" /> {/* "BAND 6 EXEMPLAR" */}
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
