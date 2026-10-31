import { NextResponse, type NextRequest } from "next/server";
import { clientIpOf, problem, upstream } from "@/lib/api/upstream";
import { cookieNames } from "@/lib/auth/cookies";
import { checkMutation } from "@/lib/auth/guard";
import { needsRefresh } from "@/lib/auth/jwt";
import { clearTokens, writeTokens } from "@/lib/auth/respond";
import { clearSupport, supportToken, writeSupport, type SupportSessionResponse } from "@/lib/auth/support";
import { refreshTokens, type TokenPair } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

interface LoginResponse extends TokenPair {
  userId: string;
  isNewUser: boolean;
}

async function relay(response: Response): Promise<Response> {
  const text = await response.text();
  return new Response(text || null, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}

async function login(request: NextRequest, path: string): Promise<Response> {
  const response = await upstream(path, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": request.headers.get("user-agent") ?? "" },
    body: await request.text(),
    clientIp: clientIpOf(request.headers),
  });
  if (!response.ok) return relay(response);
  const tokens = (await response.json()) as LoginResponse;
  // Tokens stay in HttpOnly cookies; the page only learns who signed in and whether the account is new.
  const out = NextResponse.json({ userId: tokens.userId, isNewUser: tokens.isNewUser }, { headers: { "cache-control": "no-store" } });
  writeTokens(out.cookies, tokens);
  return out;
}

/** A valid access token for calls the BFF makes on the user's behalf, refreshing when needed. */
async function currentAccess(request: NextRequest): Promise<{ token: string | null; rotated: TokenPair | null }> {
  const support = supportToken(request.cookies);
  if (support) return { token: support, rotated: null };
  const access = request.cookies.get(cookieNames.access)?.value;
  const refresh = request.cookies.get(cookieNames.refresh)?.value;
  if (!needsRefresh(access, 30)) return { token: access!, rotated: null };
  if (!refresh) return { token: null, rotated: null };
  const result = await refreshTokens(refresh);
  return result.ok ? { token: result.tokens.accessToken, rotated: result.tokens } : { token: null, rotated: null };
}

export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "altcha") return relay(await upstream("/api/v1/public/altcha/challenge"));
  if (action === "impersonation") return startSupport(request);
  return problem(404, "common.not_found");
}

/**
 * The admin panel opens `/api/auth/impersonation?token=…` with a one-time token (2 minutes). It is a top-level GET from
 * another origin, so there is no CSRF header; the single-use token is what authorizes it.
 */
async function startSupport(request: NextRequest): Promise<Response> {
  const ended = (reason: string) => NextResponse.redirect(new URL(`/support-ended?reason=${reason}`, request.url), { headers: { "cache-control": "no-store" } });
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 512) return ended("invalid");
  const response = await upstream("/api/v1/auth/support-session", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": request.headers.get("user-agent") ?? "" },
    body: JSON.stringify({ token }),
    clientIp: clientIpOf(request.headers),
  }).catch(() => null);
  if (!response?.ok) return ended(response?.status === 404 ? "gone" : "invalid");
  const session = (await response.json()) as SupportSessionResponse;
  if (!/^[0-9a-f-]{36}$/i.test(session.workspaceId)) return ended("invalid");
  const out = NextResponse.redirect(new URL(`/w/${session.workspaceId}`, request.url), { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  writeSupport(out.cookies, session);
  return out;
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if (!checkMutation(request)) return problem(403, "auth.csrf");
  const { action } = await context.params;

  switch (action) {
    case "otp-request":
      return relay(
        await upstream("/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: await request.text(),
          clientIp: clientIpOf(request.headers),
        }),
      );
    case "otp-verify":
      return login(request, "/api/v1/auth/otp/verify");
    case "password-login":
      return login(request, "/api/v1/auth/password/login");
    case "realtime-token": {
      const { token, rotated } = await currentAccess(request);
      if (!token) return problem(401, "auth.unauthorized");
      const response = await upstream("/api/v1/auth/realtime-token", { method: "POST", accessToken: token });
      const out = new NextResponse(await response.text(), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      if (rotated) writeTokens(out.cookies, rotated);
      return out;
    }
    case "support-end": {
      const support = request.cookies.get(cookieNames.support)?.value;
      if (support) await upstream("/api/v1/auth/logout", { method: "POST", accessToken: support }).catch(() => null);
      const out = new NextResponse(null, { status: 204 });
      clearSupport(out.cookies);
      return out;
    }
    case "logout": {
      const { token } = await currentAccess(request);
      // Revoke on the backend when we still can; the cookies go either way.
      if (token) await upstream("/api/v1/auth/logout", { method: "POST", accessToken: token }).catch(() => null);
      const out = new NextResponse(null, { status: 204 });
      clearTokens(out.cookies);
      clearSupport(out.cookies);
      out.cookies.delete(cookieNames.lastWorkspace);
      return out;
    }
    default:
      return problem(404, "common.not_found");
  }
}
