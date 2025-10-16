"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuthStore } from "@/store/auth";

function AuthBootstrapper() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrapper />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
