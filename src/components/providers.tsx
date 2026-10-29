"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { notifyPlanLimit, PlanLimitProvider } from "./plan-limit";

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors will not fix themselves; network and 5xx get two more tries.
  if (error instanceof ApiError && error.status < 500 && error.status !== 429) return false;
  return failureCount < 2;
}

function onAuthLost(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && typeof window !== "undefined") {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Every failed query or mutation passes through here: lost sessions go to login, plan limits open the upgrade sheet.
  const onError = (error: unknown) => {
    onAuthLost(error);
    notifyPlanLimit(error);
  };
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError }),
        mutationCache: new MutationCache({ onError }),
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PlanLimitProvider>{children}</PlanLimitProvider>
      <Toaster dir="rtl" position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </QueryClientProvider>
  );
}
