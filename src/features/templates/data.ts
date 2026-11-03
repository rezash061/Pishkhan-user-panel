"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newIdempotencyKey, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";

const ws$ = (ws: string) => ({ path: { workspaceId: ws } });

/** Published industry templates, the workspace's own industry first (BE-2.9). */
export function useTemplates(ws: string) {
  return useQuery({
    queryKey: qk.templates(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/templates", { params: ws$(ws) })),
  });
}

/** Everything applying the template would add. */
export function useTemplatePreview(ws: string, templateId: string | null) {
  return useQuery({
    queryKey: qk.template(ws, templateId ?? ""),
    enabled: Boolean(templateId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/templates/{templateId}", { params: { path: { workspaceId: ws, templateId: templateId! } } })),
  });
}

/** The last 50 applies, newest first. */
export function useTemplateApplications(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.templateApplications(ws),
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/templates/applications", { params: ws$(ws) })),
  });
}

/**
 * Applies a template. FAQs and rules arrive switched off, flows published, and the agent profile only when there is none;
 * knowledge, automations and the agent caches are refreshed.
 */
export function useApplyTemplate(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, idempotencyKey }: { templateId: string; idempotencyKey: string }) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/templates/{templateId}/apply", {
          params: { path: { workspaceId: ws, templateId }, header: { "Idempotency-Key": idempotencyKey } },
        }),
      ),
    onSuccess: () => {
      for (const key of [qk.templates(ws), qk.knowledge(ws), qk.rules(ws), qk.flows(ws), qk.agentProfile(ws)]) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

export { newIdempotencyKey };
