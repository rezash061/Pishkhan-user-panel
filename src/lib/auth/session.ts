import "server-only";
import { cookies } from "next/headers";
import { cookieNames } from "./cookies";
import { readSupportInfo, supportToken, type SupportInfo } from "./support";

/**
 * The caller's access token for server components and server actions. The request proxy (src/proxy.ts) has already
 * refreshed it if it was about to expire, so pages can use it as is. A support session's token wins over the user's own.
 */
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return supportToken(jar) ?? jar.get(cookieNames.access)?.value ?? null;
}

export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(supportToken(jar) || jar.get(cookieNames.refresh)?.value);
}

/** The running support session, if any, for the banner and the screens it closes. */
export async function getSupportSession(): Promise<SupportInfo | null> {
  return readSupportInfo(await cookies());
}
