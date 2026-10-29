import { NextResponse, type NextRequest } from "next/server";
import { cookieNames } from "@/lib/auth/cookies";
import { needsRefresh } from "@/lib/auth/jwt";
import { clearTokens, newCsrfToken, writeCsrf, writeTokens } from "@/lib/auth/respond";
import { refreshTokens } from "@/lib/auth/tokens";

/** Routes that need a signed-in user. Everything else (login, invite, offline) is public. */
const protectedPrefixes = ["/w/", "/workspaces", "/onboarding", "/account", "/channels"];
/** Routes a signed-in user has no reason to see. */
const guestOnly = ["/login"];

function isProtected(pathname: string): boolean {
  return pathname === "/" || protectedPrefixes.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const hub = process.env.NEXT_PUBLIC_HUB_URL;
  const hubOrigins = hub ? (() => { const u = new URL(hub); return [u.origin, u.origin.replace(/^http/, "ws")]; })() : [];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Instagram media thumbnails come from Meta's CDN; user files from our signed usercontent host.
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...hubOrigins, ...(dev ? ["ws:"] : [])].join(" "),
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Next.js 16 request proxy (formerly middleware): per-request CSP nonce, route protection, and refreshing the access
 * token before server components render so they always see a valid one.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const refresh = request.cookies.get(cookieNames.refresh)?.value;
  const access = request.cookies.get(cookieNames.access)?.value;
  let signedIn = Boolean(refresh);
  let refreshed: Awaited<ReturnType<typeof refreshTokens>> | null = null;

  if (refresh && needsRefresh(access)) {
    refreshed = await refreshTokens(refresh);
    if (refreshed.ok) {
      request.cookies.set(cookieNames.access, refreshed.tokens.accessToken);
      request.cookies.set(cookieNames.refresh, refreshed.tokens.refreshToken);
    } else if (refreshed.code !== "network") {
      signedIn = false;
      request.cookies.delete(cookieNames.access);
      request.cookies.delete(cookieNames.refresh);
    }
  }

  let response: NextResponse;
  if (!signedIn && isProtected(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    response = NextResponse.redirect(login);
  } else if (signedIn && guestOnly.includes(pathname)) {
    response = NextResponse.redirect(new URL(request.nextUrl.searchParams.get("next")?.startsWith("/") ? request.nextUrl.searchParams.get("next")! : "/workspaces", request.url));
  } else {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    response = NextResponse.next({ request: { headers } });
  }

  response.headers.set("content-security-policy", csp);
  if (refreshed?.ok) writeTokens(response.cookies, refreshed.tokens);
  else if (refreshed && refreshed.code !== "network") clearTokens(response.cookies);
  if (!request.cookies.get(cookieNames.csrf)) writeCsrf(response.cookies, newCsrfToken());
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|hubs/|_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
