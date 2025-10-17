"use client";

import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { status } = useAuthStore();
  const router = useRouter();

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Sign in required</CardTitle>
          <CardDescription className="text-base">
            You need to be signed in to use Focusly&apos;s AI-powered learning modules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => router.push("/")}
            className="w-full gap-2"
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <UserPlus className="h-4 w-4" />
            Create Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
