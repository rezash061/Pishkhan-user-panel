"use client";

import { api, unwrap } from "@/lib/api/client";

/**
 * Starts the official Instagram Login flow. The backend returns Meta's authorize URL; after consent Meta calls the
 * backend, which redirects to the panel's /channels page. The `pk-oauth` cookie tells that page where to go back to.
 */
export async function startInstagramConnect(workspaceId: string, from: "onboarding" | "channels"): Promise<void> {
  const { authorizeUrl } = unwrap(
    await api.POST("/api/v1/workspaces/{workspaceId}/channels/instagram/connect", { params: { path: { workspaceId } } }),
  );
  document.cookie = `pk-oauth=${workspaceId}|${from}; path=/; max-age=900; samesite=lax`;
  window.location.assign(authorizeUrl);
}
