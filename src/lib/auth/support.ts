import { cookieNames, tokenCookieOptions } from "./cookies";
import { needsRefresh } from "./jwt";
import { expireCookie } from "./respond";

/** What the panel shows about a support session. The token itself never leaves HttpOnly cookies. */
export interface SupportInfo {
  workspaceId: string;
  staffUsername: string;
  reason: string | null;
  expiresAt: string;
}

/** `POST /api/v1/auth/support-session` (backend PR #18). There is no refresh token: the session ends at expiry. */
export interface SupportSessionResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  workspaceId: string;
  userId: string;
  staffUsername: string;
  reason: string | null;
}

type CookieReader = { get(name: string): { value: string } | undefined };
type CookieWriter = Parameters<typeof expireCookie>[0];

/** The support token when one is present and not about to expire. It takes precedence over the user's own session. */
export function supportToken(jar: CookieReader): string | null {
  const token = jar.get(cookieNames.support)?.value;
  return token && !needsRefresh(token, 5) ? token : null;
}

export function readSupportInfo(jar: CookieReader): SupportInfo | null {
  if (!supportToken(jar)) return null;
  const raw = jar.get(cookieNames.supportInfo)?.value;
  if (!raw) return null;
  try {
    const info = JSON.parse(raw) as Partial<SupportInfo>;
    if (typeof info.workspaceId !== "string" || typeof info.staffUsername !== "string" || typeof info.expiresAt !== "string") return null;
    return { workspaceId: info.workspaceId, staffUsername: info.staffUsername, reason: info.reason ?? null, expiresAt: info.expiresAt };
  } catch {
    return null;
  }
}

export function writeSupport(jar: CookieWriter, session: SupportSessionResponse): void {
  const options = tokenCookieOptions(new Date(session.accessTokenExpiresAt));
  const info: SupportInfo = { workspaceId: session.workspaceId, staffUsername: session.staffUsername, reason: session.reason, expiresAt: session.accessTokenExpiresAt };
  jar.set(cookieNames.support, session.accessToken, options);
  jar.set(cookieNames.supportInfo, JSON.stringify(info), options);
}

export function clearSupport(jar: CookieWriter): void {
  expireCookie(jar, cookieNames.support);
  expireCookie(jar, cookieNames.supportInfo);
}
