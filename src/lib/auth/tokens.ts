import { apiBaseUrl } from "@/lib/env";

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export type RefreshResult = { ok: true; tokens: TokenPair } | { ok: false; code: string };

interface RefreshState {
  inflight: Map<string, Promise<RefreshResult>>;
  recent: Map<string, { result: RefreshResult; at: number }>;
}

// Shared through globalThis so the request proxy and the route handlers (separate bundles, same process) see one map.
const state: RefreshState = ((globalThis as { __pishkhanRefresh?: RefreshState }).__pishkhanRefresh ??= {
  inflight: new Map(),
  recent: new Map(),
});

const RECENT_MS = 15_000;

/**
 * Exchanges a refresh token once, however many requests ask at the same time. The backend rotates refresh tokens and
 * treats a second use of the old one as theft (`auth.refresh.reused`, which revokes the session), so parallel requests
 * that carry the same old cookie must share one exchange, and requests that arrive just after it get the same answer.
 */
export function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  const now = Date.now();
  for (const [key, entry] of state.recent) if (now - entry.at > RECENT_MS) state.recent.delete(key);

  const recent = state.recent.get(refreshToken);
  if (recent) return Promise.resolve(recent.result);

  const running = state.inflight.get(refreshToken);
  if (running) return running;

  const promise = exchange(refreshToken).then((result) => {
    state.recent.set(refreshToken, { result, at: Date.now() });
    state.inflight.delete(refreshToken);
    return result;
  });
  state.inflight.set(refreshToken, promise);
  return promise;
}

async function exchange(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/token/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true, tokens: (await response.json()) as TokenPair };
    const problem = (await response.json().catch(() => null)) as { code?: string } | null;
    return { ok: false, code: problem?.code ?? `http.${response.status}` };
  } catch {
    return { ok: false, code: "network" };
  }
}
