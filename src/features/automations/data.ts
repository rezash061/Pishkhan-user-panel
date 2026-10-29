"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { AutomationSettings, BacklogRun, Flow, FlowGraph, Rule, RuleRequest } from "@/lib/api/types";

const path = (ws: string) => ({ params: { path: { workspaceId: ws } } });

export function useRules(ws: string) {
  return useQuery({
    queryKey: qk.rules(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/rules", path(ws))),
  });
}

export function useRule(ws: string, ruleId: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.rule(ws, ruleId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}", { params: { path: { workspaceId: ws, ruleId } } })),
    initialData: () => qc.getQueryData<Rule[]>(qk.rules(ws))?.find((r) => r.id === ruleId),
  });
}

/** The request form of a stored rule (PUT replaces the whole rule, so toggles and reorders send everything). */
export function toRuleRequest(rule: Rule): RuleRequest {
  return {
    name: rule.name,
    channelAccountId: rule.channelAccountId,
    triggerKind: rule.triggerKind,
    trigger: rule.trigger,
    actions: rule.actions,
    priority: Number(rule.priority),
    enabled: rule.enabled,
  };
}

export function useSaveRule(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: RuleRequest }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}", { params: { path: { workspaceId: ws, ruleId: id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/rules", { ...path(ws), body })),
    onSuccess: (rule) => {
      qc.setQueryData(qk.rule(ws, rule.id), rule);
      qc.setQueryData<Rule[]>(qk.rules(ws), (list) => (list ? (list.some((r) => r.id === rule.id) ? list.map((r) => (r.id === rule.id ? rule : r)) : [...list, rule]) : list));
      void qc.invalidateQueries({ queryKey: qk.rules(ws) });
    },
  });
}

export function useDeleteRule(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}", { params: { path: { workspaceId: ws, ruleId } } });
      if (!response.ok) unwrap({ error, response });
      return ruleId;
    },
    onSuccess: (ruleId) => {
      qc.setQueryData<Rule[]>(qk.rules(ws), (list) => list?.filter((r) => r.id !== ruleId));
      qc.removeQueries({ queryKey: qk.rule(ws, ruleId) });
    },
  });
}

export const backlogRunning = (run: BacklogRun | null | undefined) => run?.status === "queued" || run?.status === "running";

export function useRuleStats(ws: string, ruleId: string, days: number) {
  return useQuery({
    queryKey: qk.ruleStats(ws, ruleId, days),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}/stats", { params: { path: { workspaceId: ws, ruleId }, query: { days } } })),
    // While a backlog run works through a post's old comments, refresh its counters.
    refetchInterval: (query) => (backlogRunning(query.state.data?.latestBacklogRun) ? 3000 : false),
  });
}

export function useStartBacklog(ws: string, ruleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}/backlog-run", { params: { path: { workspaceId: ws, ruleId } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rule-stats", ws, ruleId] }),
  });
}

export function useFlows(ws: string) {
  return useQuery({
    queryKey: qk.flows(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/flows", path(ws))),
  });
}

export function useFlow(ws: string, flowId: string) {
  return useQuery({
    queryKey: qk.flow(ws, flowId),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/flows/{flowId}", { params: { path: { workspaceId: ws, flowId } } })),
  });
}

function storeFlow(qc: ReturnType<typeof useQueryClient>, ws: string, flow: Flow) {
  qc.setQueryData(qk.flow(ws, flow.id), flow);
  qc.setQueryData<Flow[]>(qk.flows(ws), (list) => (list ? (list.some((f) => f.id === flow.id) ? list.map((f) => (f.id === flow.id ? flow : f)) : [flow, ...list]) : list));
}

export function useSaveFlow(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, graph }: { id?: string; name: string; graph: FlowGraph }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/automation/flows/{flowId}", { params: { path: { workspaceId: ws, flowId: id } }, body: { name, graph } }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/flows", { ...path(ws), body: { name, graph } })),
    onSuccess: (flow) => storeFlow(qc, ws, flow),
  });
}

export function usePublishFlow(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flowId: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/flows/{flowId}/publish", { params: { path: { workspaceId: ws, flowId } } })),
    onSuccess: (flow) => storeFlow(qc, ws, flow),
  });
}

export function useDeleteFlow(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flowId: string) => {
      const { response, error } = await api.DELETE("/api/v1/workspaces/{workspaceId}/automation/flows/{flowId}", { params: { path: { workspaceId: ws, flowId } } });
      if (!response.ok) unwrap({ error, response });
      return flowId;
    },
    onSuccess: (flowId) => {
      qc.setQueryData<Flow[]>(qk.flows(ws), (list) => list?.filter((f) => f.id !== flowId));
      qc.removeQueries({ queryKey: qk.flow(ws, flowId) });
    },
  });
}

export function useAutomationSettings(ws: string) {
  return useQuery({
    queryKey: qk.automationSettings(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/automation/settings", path(ws))),
  });
}

export function useSaveAutomationSettings(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AutomationSettings) =>
      unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/automation/settings", { ...path(ws), body: { ...body, fallbackCooldownMinutes: Number(body.fallbackCooldownMinutes) } })),
    onSuccess: (data) => qc.setQueryData(qk.automationSettings(ws), data),
  });
}
