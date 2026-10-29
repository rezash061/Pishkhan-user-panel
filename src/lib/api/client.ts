"use client";

import createClient, { type FetchResponse } from "openapi-fetch";
import { ApiError, type Problem } from "./errors";
import type { paths } from "./schema";

const CSRF_COOKIES = ["__Host-pk-csrf", "pk-csrf"];

export function csrfToken(): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name && CSRF_COOKIES.includes(name)) return decodeURIComponent(rest.join("="));
  }
  return "";
}

/** Calls go to this app's BFF (`/api/bff/*`), which adds the bearer token. Paths stay typed as the backend's `/api/v1/*`. */
const bffFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api\/v1\//, "/api/bff/");
  const headers = new Headers(request.headers);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  if (hasBody) headers.set("x-csrf-token", csrfToken());
  // Buffer the body: a streamed request body (ReadableStream) needs HTTP/2 in Chromium and fails over HTTP/1.1.
  const body = hasBody ? await request.arrayBuffer() : undefined;
  return fetch(url, { method: request.method, headers, body, credentials: "same-origin" });
};

export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  fetch: bffFetch,
});

/** Returns the data or throws an ApiError (TanStack Query then shows the error state). */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, (result.error ?? null) as Problem | null);
  }
  return result.data as T;
}

export type { FetchResponse };

/** POST to this app's own auth routes (`/api/auth/*`) with the CSRF header. */
export async function authPost<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!response.ok) throw new ApiError(response.status, (await response.json().catch(() => null)) as Problem | null);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
