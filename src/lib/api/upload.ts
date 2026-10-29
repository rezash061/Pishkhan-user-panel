"use client";

import { api, csrfToken, unwrap } from "./client";
import { ApiError, toApiError } from "./errors";
import type { FileInfo } from "./types";

export type FilePurpose = "product_image" | "import_sheet";

/** Upload sizes from backend `FilePolicy` (checked here only to fail fast; the backend enforces them). */
export const maxUploadBytes: Record<FilePurpose, number> = { product_image: 10 * 1024 * 1024, import_sheet: 5 * 1024 * 1024 };

/** Multipart upload through the BFF (one part named `file`, query `purpose`). The file starts as `pending_scan`. */
export async function uploadFile(ws: string, purpose: FilePurpose, file: File): Promise<FileInfo> {
  if (file.size > maxUploadBytes[purpose]) throw new ApiError(413, { code: "validation.file.too_large" });
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`/api/bff/workspaces/${encodeURIComponent(ws)}/files?purpose=${purpose}`, {
    method: "POST",
    body: form,
    headers: { "x-csrf-token": csrfToken() },
    credentials: "same-origin",
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as FileInfo;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls until the virus scan finishes. Resolves with the clean file; rejects for infected, rejected or failed scans. */
export async function waitUntilScanned(ws: string, fileId: string, { timeoutMs = 60_000 } = {}): Promise<FileInfo> {
  const started = Date.now();
  let delay = 700;
  for (;;) {
    const file = unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/files/{fileId}", { params: { path: { workspaceId: ws, fileId } } }));
    if (file.status === "clean") return file;
    if (file.status !== "pending_scan") throw new ApiError(422, { code: `files.${file.status}` });
    if (Date.now() - started > timeoutMs) throw new ApiError(504, { code: "files.scan_timeout" });
    await sleep(delay);
    delay = Math.min(delay * 1.5, 3000);
  }
}
