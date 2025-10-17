"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { focuslyApi } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setStatus("error");
        setMessage("No verification token provided.");
        return;
      }

      try {
        await focuslyApi.verifyEmail(token);
        setStatus("success");
        setMessage("Your email has been successfully verified!");
      } catch (error) {
        setStatus("error");
        if (error instanceof Error) {
          setMessage(error.message || "Verification failed. The link may be invalid or expired.");
        } else {
          setMessage("Verification failed. The link may be invalid or expired.");
        }
      }
    }

    void verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-4">
            {status === "loading" && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            {status === "success" && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            )}
            {status === "error" && (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-8 w-8" />
              </div>
            )}

            <CardTitle className="text-2xl">
              {status === "loading" && "Verifying Email"}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
            </CardTitle>

            <CardDescription className="text-base">
              {status === "loading" && "Please wait while we verify your email address..."}
              {status === "success" && message}
              {status === "error" && message}
            </CardDescription>
          </CardHeader>

          {status !== "loading" && (
            <CardContent className="space-y-3">
              {status === "success" ? (
                <Button
                  onClick={() => router.push("/workspace")}
                  className="w-full"
                  size="lg"
                >
                  Go to Workspace
                </Button>
              ) : (
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Back to Home
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Verifying Email</CardTitle>
            <CardDescription className="text-base">
              Please wait while we verify your email address...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
