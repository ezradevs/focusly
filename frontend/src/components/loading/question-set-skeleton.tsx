import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface QuestionSetSkeletonProps {
  count?: number;
}

export function QuestionSetSkeleton({ count = 5 }: QuestionSetSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" /> {/* Type badge */}
              <Skeleton className="h-5 w-24" /> {/* Difficulty badge */}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question prompt */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>

            <Separator />

            {/* Options for MCQ */}
            {index % 3 === 0 && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {/* Answer section */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" /> {/* "Answer" label */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Explanation section */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" /> {/* "Explanation" label */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
