/** Reads the `exp` claim of a JWT without verifying it (the backend verifies; this only schedules refreshes). */
export function jwtExpiry(token: string): Date | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, unreadable or expires within `skewSeconds`. */
export function needsRefresh(token: string | undefined, skewSeconds = 60, now = Date.now()): boolean {
  if (!token) return true;
  const exp = jwtExpiry(token);
  return !exp || exp.getTime() - now < skewSeconds * 1000;
}
