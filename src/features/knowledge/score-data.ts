"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

/** The knowledge score (0–100), its parts, the required facts and what to do next (BE-1.9). */
export function useKnowledgeScore(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.knowledgeScore(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/knowledge/score", { params: ws$(ws) })),
  });
}

/** Turns the owner's own words for a fact into a FAQ draft; nothing is saved. */
export function useDraftFact(ws: string) {
  return useMutation({
    mutationFn: async (body: { factKey: string; answer: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/onboarding/draft", { params: ws$(ws), body })),
  });
}

/** Saves the approved FAQ (enabled) and returns the new score, which replaces the cached one. */
export function useConfirmFact(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { factKey: string; question: string; answer: string }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/knowledge/onboarding/confirm", { params: ws$(ws), body })),
    onSuccess: ({ score }) => {
      qc.setQueryData(qk.knowledgeScore(ws), score);
      void qc.invalidateQueries({ queryKey: qk.knowledge(ws), predicate: (q) => q.queryKey[2] !== "score" });
    },
  });
}
