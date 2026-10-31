import { NextResponse, type NextRequest } from "next/server";
import { clientIpOf, problem, requestHeadersFor, responseHeadersFrom } from "@/lib/api/upstream";
import { cookieNames } from "@/lib/auth/cookies";
import { checkMutation } from "@/lib/auth/guard";
import { needsRefresh } from "@/lib/auth/jwt";
import { clearTokens, writeTokens } from "@/lib/auth/respond";
import { clearSupport, supportToken } from "@/lib/auth/support";
import { refreshTokens, type TokenPair } from "@/lib/auth/tokens";
import { apiBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Browser → backend proxy for `/api/v1/*` (overview section 5, BFF rule). Attaches the bearer token from the HttpOnly
 * cookie, refreshes it once when it is about to expire or the backend answers 401, and enforces Origin + CSRF on mutations.
 */
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!checkMutation(request)) return problem(403, "auth.csrf");

  const { path } = await context.params;
  if (path.some((segment) => segment === ".." || segment === "." || segment.includes("\\"))) return problem(400, "request.invalid");
  // Auth endpoints go through /api/auth/*, which owns the token cookies.
  if (path[0] === "auth") return problem(404, "common.not_found");

  const target = `${apiBaseUrl}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const clientIp = clientIpOf(request.headers);

  // Support session: its own token, never refreshed. A 401 means it ended, so its cookies go.
  const support = supportToken(request.cookies);
  if (support) {
    const response = await fetch(target, { method: request.method, headers: requestHeadersFor(request.headers, support, clientIp), body, cache: "no-store", redirect: "manual" });
    const out = new NextResponse(response.status === 204 || response.status === 304 ? null : response.body, { status: response.status, headers: responseHeadersFrom(response.headers) });
    if (response.status === 401) clearSupport(out.cookies);
    return out;
  }

  const refreshToken = request.cookies.get(cookieNames.refresh)?.value;
  let accessToken = request.cookies.get(cookieNames.access)?.value ?? null;
  if (!refreshToken) return problem(401, "auth.unauthorized");

  let rotated: TokenPair | null = null;
  let failed = false;
  const refresh = async () => {
    const result = await refreshTokens(refreshToken);
    if (result.ok) {
      rotated = result.tokens;
      accessToken = result.tokens.accessToken;
    } else if (result.code !== "network") {
      failed = true;
    }
    return result.ok;
  };

  if (needsRefresh(accessToken ?? undefined, 30)) await refresh();

  const send = () => fetch(target, { method: request.method, headers: requestHeadersFor(request.headers, accessToken, clientIp), body, cache: "no-store", redirect: "manual" });

  let response = await send();
  if (response.status === 401 && !rotated && !failed && (await refresh())) response = await send();

  const out = new NextResponse(response.status === 204 || response.status === 304 ? null : response.body, {
    status: response.status,
    headers: responseHeadersFrom(response.headers),
  });
  if (rotated) writeTokens(out.cookies, rotated);
  if (failed) clearTokens(out.cookies);
  return out;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
