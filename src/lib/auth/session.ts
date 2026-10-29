import "server-only";
import { cookies } from "next/headers";
import { cookieNames } from "./cookies";

/**
 * The caller's access token for server components and server actions. The request proxy (src/proxy.ts) has already
 * refreshed it if it was about to expire, so pages can use it as is.
 */
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieNames.access)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(cookieNames.refresh)?.value);
}
