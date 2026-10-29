import { NextResponse, type NextRequest } from "next/server";
import { clientIpOf, problem, upstream } from "@/lib/api/upstream";
import { cookieNames } from "@/lib/auth/cookies";
import { checkMutation } from "@/lib/auth/guard";
import { needsRefresh } from "@/lib/auth/jwt";
import { clearTokens, writeTokens } from "@/lib/auth/respond";
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
  return problem(404, "common.not_found");
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
    case "logout": {
      const { token } = await currentAccess(request);
      // Revoke on the backend when we still can; the cookies go either way.
      if (token) await upstream("/api/v1/auth/logout", { method: "POST", accessToken: token }).catch(() => null);
      const out = new NextResponse(null, { status: 204 });
      clearTokens(out.cookies);
      out.cookies.delete(cookieNames.lastWorkspace);
      return out;
    }
    default:
      return problem(404, "common.not_found");
  }
}
