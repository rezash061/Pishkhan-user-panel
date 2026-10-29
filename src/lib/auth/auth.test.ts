import { afterEach, describe, expect, it, vi } from "vitest";
import { needsRefresh } from "./jwt";
import { refreshTokens } from "./tokens";

function jwt(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `e30.${payload}.sig`;
}

describe("needsRefresh", () => {
  const now = Date.parse("2026-10-29T10:00:00Z");
  it("refreshes missing, unreadable and nearly expired tokens", () => {
    expect(needsRefresh(undefined, 60, now)).toBe(true);
    expect(needsRefresh("garbage", 60, now)).toBe(true);
    expect(needsRefresh(jwt(now / 1000 + 30), 60, now)).toBe(true);
    expect(needsRefresh(jwt(now / 1000 + 600), 60, now)).toBe(false);
  });
});

describe("refreshTokens", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exchanges a refresh token once for concurrent callers (the backend revokes on reuse)", async () => {
    const tokens = { accessToken: "a2", accessTokenExpiresAt: "x", refreshToken: "r2", refreshTokenExpiresAt: "y" };
    const fetchMock = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return Response.json(tokens);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([refreshTokens("r1-concurrent"), refreshTokens("r1-concurrent"), refreshTokens("r1-concurrent")]);
    // A request that arrives right after the exchange gets the same answer instead of reusing the old token.
    const late = await refreshTokens("r1-concurrent");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const r of [...results, late]) expect(r).toEqual({ ok: true, tokens });
  });

  it("reports the backend's problem code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "auth.refresh.reused" }, { status: 401 })));
    expect(await refreshTokens("r-reused")).toEqual({ ok: false, code: "auth.refresh.reused" });
  });
});
