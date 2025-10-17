import { create } from "zustand";
import { focuslyApi } from "@/lib/api";
import type { AuthUser } from "@/types";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  signup: (payload: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setError: (message: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,
  setError: (message) => set({ error: message }),
  bootstrap: async () => {
    set({ status: "loading" });
    try {
      const response = await focuslyApi.currentUser();
      if (response.user) {
        set({ user: response.user, status: "authenticated", error: null });
      } else {
        set({ user: null, status: "unauthenticated", error: null });
      }
    } catch (error) {
      // Failed to fetch user - likely not logged in or network error
      // This is expected behavior, so we don't set an error message
      set({ user: null, status: "unauthenticated", error: null });

      // In development, log the error for debugging
      if (process.env.NODE_ENV === "development") {
        console.info("Auth bootstrap failed:", error instanceof Error ? error.message : "Unknown error");
      }
    }
  },
  login: async ({ email, password }) => {
    set({ status: "loading", error: null });
    try {
      const response = await focuslyApi.login({ email, password });
      set({ user: response.user, status: "authenticated", error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unable to login.", status: "unauthenticated" });
      throw error;
    }
  },
  signup: async ({ email, password, name }) => {
    set({ status: "loading", error: null });
    try {
      const response = await focuslyApi.signup({ email, password, name });
      set({ user: response.user, status: "authenticated", error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unable to sign up.", status: "unauthenticated" });
      throw error;
    }
  },
  logout: async () => {
    try {
      await focuslyApi.logout();
    } catch {
      // Silently fail - user will be logged out regardless
    } finally {
      set({ user: null, status: "unauthenticated" });
    }
  },
}));
