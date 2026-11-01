"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { ContactExport, FieldDefinitionInput, SegmentRule } from "@/lib/api/types";

export interface ContactFilter {
  q?: string;
  tag?: string;
  segmentId?: string;
  channelAccountId?: string;
  hasPhone?: boolean;
  consent?: string;
}

const path = (ws: string) => ({ path: { workspaceId: ws } });

export function useContacts(ws: string, filter: ContactFilter) {
  return useInfiniteQuery({
    queryKey: qk.contactList(ws, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/contacts", {
          params: {
            path: { workspaceId: ws },
            query: {
              limit: 30,
              ...(pageParam ? { cursor: pageParam } : {}),
              ...(filter.q ? { q: filter.q } : {}),
              ...(filter.tag ? { tag: filter.tag } : {}),
              ...(filter.segmentId ? { segmentId: filter.segmentId } : {}),
              ...(filter.channelAccountId ? { channelAccountId: filter.channelAccountId } : {}),
              ...(filter.hasPhone !== undefined ? { hasPhone: filter.hasPhone } : {}),
              ...(filter.consent ? { consent: filter.consent } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    placeholderData: keepPreviousData,
  });
}

export function useContact(ws: string, id: string) {
  return useQuery({
    queryKey: qk.contact(ws, id),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/contacts/{contactId}", { params: { path: { workspaceId: ws, contactId: id } } })),
  });
}

export interface ContactPatch {
  displayName?: string | null;
  clearDisplayName?: boolean;
  tags?: string[] | null;
  fields?: Record<string, string | null> | null;
}

export function useUpdateContact(ws: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ContactPatch) =>
      unwrap(
        await api.PATCH("/api/v1/workspaces/{workspaceId}/contacts/{contactId}", {
          params: { path: { workspaceId: ws, contactId: id } },
          // `fields` merges and null removes a value; the generated type says string, the backend takes null too.
          body: { displayName: null, clearDisplayName: false, tags: null, fields: null, ...patch } as never,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts(ws) });
      void qc.invalidateQueries({ queryKey: qk.crmTags(ws) });
      void qc.invalidateQueries({ queryKey: ["conversations", ws] });
    },
  });
}

export function useFields(ws: string) {
  return useQuery({
    queryKey: qk.crmFields(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/crm/fields", { params: path(ws) })),
    staleTime: 60_000,
  });
}

export function useSaveField(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string | null; body: FieldDefinitionInput }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/crm/fields/{fieldId}", { params: { path: { workspaceId: ws, fieldId: id } }, body }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/crm/fields", { params: path(ws), body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.crmFields(ws) }),
  });
}

export function useDeleteField(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.DELETE("/api/v1/workspaces/{workspaceId}/crm/fields/{fieldId}", { params: { path: { workspaceId: ws, fieldId: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.crmFields(ws) }),
  });
}

export function useTags(ws: string) {
  return useQuery({
    queryKey: qk.crmTags(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/crm/tags", { params: path(ws) })),
    staleTime: 30_000,
  });
}

function useTagMutation<T>(ws: string, fn: (vars: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.crmTags(ws) });
      void qc.invalidateQueries({ queryKey: qk.contacts(ws) });
      void qc.invalidateQueries({ queryKey: qk.crmSegments(ws) });
    },
  });
}

export function useSaveTag(ws: string) {
  return useTagMutation(ws, async ({ name, color, description }: { name: string; color: string | null; description: string | null }) =>
    unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/crm/tags/{name}", { params: { path: { workspaceId: ws, name } }, body: { color, description } })),
  );
}

export function useRenameTag(ws: string) {
  return useTagMutation(ws, async ({ name, newName }: { name: string; newName: string }) =>
    unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/crm/tags/{name}/rename", { params: { path: { workspaceId: ws, name } }, body: { newName } })),
  );
}

export function useDeleteTag(ws: string) {
  return useTagMutation(ws, async (name: string) => unwrap(await api.DELETE("/api/v1/workspaces/{workspaceId}/crm/tags/{name}", { params: { path: { workspaceId: ws, name } } })));
}

export function useSegments(ws: string) {
  return useQuery({
    queryKey: qk.crmSegments(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/crm/segments", { params: path(ws) })),
  });
}

export function useSaveSegment(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, rule }: { id: string | null; name: string; rule: SegmentRule }) =>
      id
        ? unwrap(await api.PUT("/api/v1/workspaces/{workspaceId}/crm/segments/{segmentId}", { params: { path: { workspaceId: ws, segmentId: id } }, body: { name, rule } }))
        : unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/crm/segments", { params: path(ws), body: { name, rule } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.crmSegments(ws) }),
  });
}

export function useDeleteSegment(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.DELETE("/api/v1/workspaces/{workspaceId}/crm/segments/{segmentId}", { params: { path: { workspaceId: ws, segmentId: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.crmSegments(ws) }),
  });
}

/** Live match count while a rule is edited. Only complete rules are sent; the caller debounces. */
export function useSegmentPreview(ws: string, rule: SegmentRule | null) {
  return useQuery({
    queryKey: qk.segmentPreview(ws, rule ?? {}),
    queryFn: async () => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/crm/segments/preview", { params: path(ws), body: rule! })),
    enabled: rule !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Flows that collected answers (form questions in a flow), newest submission first. */
export function useForms(ws: string) {
  return useQuery({
    queryKey: qk.crmForms(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/crm/forms", { params: path(ws) })),
  });
}

export function useFormSubmissions(ws: string, flowId: string) {
  return useInfiniteQuery({
    queryKey: qk.formSubmissions(ws, flowId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/crm/forms/{flowId}/submissions", {
          params: { path: { workspaceId: ws, flowId }, query: { limit: 30, ...(pageParam ? { cursor: pageParam } : {}) } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
  });
}

export function useContactSubmissions(ws: string, id: string) {
  return useQuery({
    queryKey: qk.contactSubmissions(ws, id),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/contacts/{contactId}/submissions", { params: { path: { workspaceId: ws, contactId: id } } })),
  });
}

export const consentChannels = ["sms", "phone", "bale"] as const;
export type ConsentChannel = (typeof consentChannels)[number];

export function useConsents(ws: string, id: string) {
  return useQuery({
    queryKey: qk.contactConsents(ws, id),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/contacts/{contactId}/consents", { params: { path: { workspaceId: ws, contactId: id } } })),
  });
}

export function useRecordConsent(ws: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { channel: ConsentChannel; granted: boolean; evidence: string | null }) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/contacts/{contactId}/consents", { params: { path: { workspaceId: ws, contactId: id } }, body })),
    onSuccess: (data) => {
      qc.setQueryData(qk.contactConsents(ws, id), data);
      void qc.invalidateQueries({ queryKey: ["contacts", ws, "list"] });
    },
  });
}

const pendingExport = (e: ContactExport) => e.status === "pending";

/** The caller's own exports; polls while one is still being written. */
export function useExports(ws: string, enabled = true) {
  return useQuery({
    queryKey: qk.contactExports(ws),
    queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/contacts/exports", { params: path(ws) })),
    enabled,
    refetchInterval: (q) => (q.state.data?.some(pendingExport) ? 4000 : false),
  });
}

export function useStartExport(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (filter: ContactFilter) =>
      unwrap(
        await api.POST("/api/v1/workspaces/{workspaceId}/contacts/exports", {
          params: path(ws),
          body: {
            q: filter.q || null,
            tag: filter.tag || null,
            segmentId: filter.segmentId || null,
            channelAccountId: filter.channelAccountId || null,
            hasPhone: filter.hasPhone ?? null,
            consent: filter.consent || null,
          },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.contactExports(ws) }),
  });
}

/** One-time, five-minute link. The list is refreshed after, since the export is then «downloaded». */
export function useDownloadExport(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/contacts/exports/{exportId}/download", { params: { path: { workspaceId: ws, exportId: id } } })),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.contactExports(ws) }),
  });
}
