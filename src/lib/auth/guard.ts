import type { NextRequest } from "next/server";
import { CSRF_HEADER, cookieNames } from "./cookies";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Mutations through the BFF must come from this origin (Origin header) and carry the double-submit CSRF token
 * (header equal to the readable CSRF cookie). SameSite=Lax cookies already stop most cross-site posts; this closes the rest.
 */
export function checkMutation(request: NextRequest): boolean {
  if (safeMethods.has(request.method)) return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    if (new URL(origin).host !== host) return false;
  } catch {
    return false;
  }
  const cookie = request.cookies.get(cookieNames.csrf)?.value;
  const header = request.headers.get(CSRF_HEADER);
  return Boolean(cookie && header && cookie.length >= 16 && cookie === header);
}
