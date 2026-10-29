import "server-only";
import { cache } from "react";
import type { Me, Workspace } from "./types";
import { serverApi } from "./server";

/** Per-request cached loaders for server components (layouts and pages share one fetch). */
export const loadMe = cache(async (): Promise<Me | null> => {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/me");
  return data ?? null;
});

export const loadWorkspaces = cache(async (): Promise<Workspace[] | null> => {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/workspaces");
  return data ?? null;
});

export const loadWorkspace = cache(async (workspaceId: string): Promise<{ workspace: Workspace | null; status: number }> => {
  const api = await serverApi();
  const { data, response } = await api.GET("/api/v1/workspaces/{workspaceId}", { params: { path: { workspaceId } } });
  return { workspace: data ?? null, status: response.status };
});
