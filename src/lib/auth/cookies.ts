import { secureCookies } from "@/lib/env";

const prefix = secureCookies ? "__Host-" : "";

/** Cookie names. Tokens are HttpOnly; the CSRF cookie is readable by the page for the double-submit check. */
export const cookieNames = {
  access: `${prefix}pk-at`,
  refresh: `${prefix}pk-rt`,
  csrf: `${prefix}pk-csrf`,
  /** Last workspace the user opened; lets OAuth returns and "/" land in the right workspace. Not a secret. */
  lastWorkspace: "pk-ws",
} as const;

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  expires?: Date;
  maxAge?: number;
}

export function tokenCookieOptions(expires: Date): CookieOptions {
  return { httpOnly: true, secure: secureCookies, sameSite: "lax", path: "/", expires };
}

export function csrfCookieOptions(): CookieOptions {
  return { httpOnly: false, secure: secureCookies, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 };
}

export const CSRF_HEADER = "x-csrf-token";
