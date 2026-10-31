"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

export function useCurrentPlan(ws: string) {
  return useQuery({
    queryKey: qk.billingPlan(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/subscription", { params: { path: { workspaceId: ws } } })),
  });
}

export function useUsage(ws: string) {
  return useQuery({
    queryKey: qk.billingUsage(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/billing/usage", { params: { path: { workspaceId: ws } } })),
    refetchInterval: 5 * 60_000,
  });
}

/** 0–1 share of a limit, or null when the meter is unlimited. */
export function shareOf(used: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined) return null;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, used / limit);
}

export type MeterState = "ok" | "near" | "full";

export function meterState(used: number, limit: number | null | undefined): MeterState {
  const share = shareOf(used, limit);
  if (share === null) return "ok";
  if (share >= 1) return "full";
  return share >= 0.8 ? "near" : "ok";
}

/** Whole days from now until `endsAt` (at least 0), for "۱۲ روز مانده". */
export function daysLeft(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000));
}
