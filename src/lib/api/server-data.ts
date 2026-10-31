import "server-only";
import { cache } from "react";
import type { Me, Workspace } from "./types";
import { serverApi } from "./server";

/**
 * A backend answer a server component cannot render. Only 401 means "signed out" (the loaders return null for it);
 * anything else (500, 404 from a wrong API URL, a proxy error page) is thrown so the error page shows it instead of
 * sending a signed-in user back to /login, which the proxy would bounce straight back: a redirect loop.
 */
export class BackendError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Backend answered ${status} for ${path}`);
    this.name = "BackendError";
  }
}

function orThrow<T>(path: string, data: T | undefined, response: Response): T | null {
  if (response.ok && data !== undefined) return data;
  if (response.status === 401) return null;
  console.error(`[pishkhan] ${path} -> ${response.status} ${response.statusText} (PISHKHAN_API_URL=${process.env.PISHKHAN_API_URL ?? "default"})`);
  throw new BackendError(path, response.status);
}

/** Per-request cached loaders for server components (layouts and pages share one fetch). null means the session is gone. */
export const loadMe = cache(async (): Promise<Me | null> => {
  const api = await serverApi();
  const { data, response } = await api.GET("/api/v1/me");
  return orThrow("/api/v1/me", data, response);
});

export const loadWorkspaces = cache(async (): Promise<Workspace[] | null> => {
  const api = await serverApi();
  const { data, response } = await api.GET("/api/v1/workspaces");
  return orThrow("/api/v1/workspaces", data, response);
});

/** `workspace` is null for 404 (not a member, or pending deletion); `status` 401 means the session is gone. */
export const loadWorkspace = cache(async (workspaceId: string): Promise<{ workspace: Workspace | null; status: number }> => {
  const api = await serverApi();
  const { data, response } = await api.GET("/api/v1/workspaces/{workspaceId}", { params: { path: { workspaceId } } });
  if (response.status === 404 || response.status === 403) return { workspace: null, status: response.status };
  return { workspace: orThrow(`/api/v1/workspaces/${workspaceId}`, data, response), status: response.status };
});
