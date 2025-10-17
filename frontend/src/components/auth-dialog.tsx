"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { focuslyApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Name too short").max(80, "Name too long"),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

type FormValues = LoginValues | SignupValues;

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = React.useState<"login" | "signup">("signup");
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState("");
  const [isSendingReset, setIsSendingReset] = React.useState(false);
  const status = useAuthStore((state) => state.status);
  const errorMessage = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const setError = useAuthStore((state) => state.setError);

  const isLoading = status === "loading";

  const form = useForm<FormValues>({
    resolver: zodResolver(mode === "login" ? loginSchema : signupSchema) as Resolver<FormValues>,
    defaultValues: {
      email: "",
      password: "",
      name: "",
    } as SignupValues,
  });

  React.useEffect(() => {
    form.reset({
      email: "",
      password: "",
      name: "",
    } as SignupValues);
    setError(null);
  }, [mode, form, setError]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (mode === "login") {
        const loginValues = values as LoginValues;
        await login({ email: loginValues.email, password: loginValues.password });
      } else {
        const signupValues = values as SignupValues;
        await signup({
          email: signupValues.email,
          password: signupValues.password,
          name: signupValues.name,
        });
      }
      handleClose(false);
    } catch {
      // handled in store
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSendingReset(true);
    try {
      await focuslyApi.requestPasswordReset(forgotPasswordEmail);
      toast.success("Password reset link sent! Check your email.");
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setIsSendingReset(false);
    }
  };

  if (showForgotPassword) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Reset Your Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-sm font-medium">
                Email
              </label>
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  className="border-0 p-0 focus-visible:ring-0"
                  placeholder="name@email.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  disabled={isSendingReset}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSendingReset}>
              {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="font-medium text-primary hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create your Focusly account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to sync your study workspace across devices."
              : "Sign up to save your generated content and track progress."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        className="border-0 p-0 focus-visible:ring-0"
                        placeholder="name@email.com"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "signup" && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <Input
                          className="border-0 p-0 focus-visible:ring-0"
                          placeholder="Preferred display name"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <FormControl>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        className="border-0 p-0 focus-visible:ring-0"
                        placeholder="••••••••"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {errorMessage && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Don’t have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            className={cn("font-medium text-primary hover:underline")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
