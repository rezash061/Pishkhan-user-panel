import type { NextResponse } from "next/server";
import { cookieNames, csrfCookieOptions, tokenCookieOptions } from "./cookies";
import type { TokenPair } from "./tokens";

type CookieWriter = Pick<NextResponse["cookies"], "set" | "delete">;

export function writeTokens(jar: CookieWriter, tokens: TokenPair): void {
  jar.set(cookieNames.access, tokens.accessToken, tokenCookieOptions(new Date(tokens.accessTokenExpiresAt)));
  jar.set(cookieNames.refresh, tokens.refreshToken, tokenCookieOptions(new Date(tokens.refreshTokenExpiresAt)));
}

/**
 * Expires a token cookie. A plain `delete` sends no `Secure` attribute, and browsers ignore a `__Host-` cookie set
 * without it, so the old token would survive sign-out; expiring it with the same options it was set with works.
 */
export function expireCookie(jar: Pick<NextResponse["cookies"], "set">, name: string): void {
  jar.set(name, "", tokenCookieOptions(new Date(0)));
}

export function clearTokens(jar: CookieWriter): void {
  expireCookie(jar, cookieNames.access);
  expireCookie(jar, cookieNames.refresh);
}

export function newCsrfToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

export function writeCsrf(jar: CookieWriter, token: string): void {
  jar.set(cookieNames.csrf, token, csrfCookieOptions());
}
