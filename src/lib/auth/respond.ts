import type { NextResponse } from "next/server";
import { cookieNames, csrfCookieOptions, tokenCookieOptions } from "./cookies";
import type { TokenPair } from "./tokens";

type CookieWriter = Pick<NextResponse["cookies"], "set" | "delete">;

export function writeTokens(jar: CookieWriter, tokens: TokenPair): void {
  jar.set(cookieNames.access, tokens.accessToken, tokenCookieOptions(new Date(tokens.accessTokenExpiresAt)));
  jar.set(cookieNames.refresh, tokens.refreshToken, tokenCookieOptions(new Date(tokens.refreshTokenExpiresAt)));
}

export function clearTokens(jar: CookieWriter): void {
  jar.delete(cookieNames.access);
  jar.delete(cookieNames.refresh);
}

export function newCsrfToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

export function writeCsrf(jar: CookieWriter, token: string): void {
  jar.set(cookieNames.csrf, token, csrfCookieOptions());
}
