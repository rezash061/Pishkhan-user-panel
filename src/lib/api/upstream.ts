import { apiBaseUrl } from "@/lib/env";

/** Headers copied from the browser request to the backend. Never cookies or authorization. */
const forwardedRequestHeaders = ["content-type", "accept", "idempotency-key", "if-match", "user-agent", "accept-language"];
/** Headers copied from the backend response to the browser. */
const forwardedResponseHeaders = ["content-type", "content-disposition", "etag", "retry-after", "idempotent-replayed", "location"];

export function pickHeaders(source: Headers, names: string[]): Headers {
  const out = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

export function requestHeadersFor(source: Headers, accessToken: string | null, clientIp: string | null): Headers {
  const headers = pickHeaders(source, forwardedRequestHeaders);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  return headers;
}

export function responseHeadersFrom(source: Headers): Headers {
  const headers = pickHeaders(source, forwardedResponseHeaders);
  headers.set("cache-control", "no-store");
  return headers;
}

export function clientIpOf(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip");
}

export async function upstream(path: string, init: RequestInit & { accessToken?: string | null; clientIp?: string | null } = {}): Promise<Response> {
  const { accessToken, clientIp, headers, ...rest } = init;
  const h = new Headers(headers);
  if (accessToken) h.set("authorization", `Bearer ${accessToken}`);
  if (clientIp) h.set("x-forwarded-for", clientIp);
  if (!h.has("accept")) h.set("accept", "application/json");
  return fetch(`${apiBaseUrl}${path}`, { ...rest, headers: h, cache: "no-store", redirect: "manual" });
}

/** A Problem Details response produced by the BFF itself (same shape as the backend's). */
export function problem(status: number, code: string): Response {
  return Response.json({ type: "about:blank", title: code, status, code }, { status, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } });
}
