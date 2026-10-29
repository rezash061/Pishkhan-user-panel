"use client";

interface Challenge {
  algorithm: string;
  challenge: string;
  maxNumber: number;
  salt: string;
  signature: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Self-hosted ALTCHA proof of work (no foreign CAPTCHA): fetch a signed challenge from the backend and find the number
 * whose SHA-256 with the salt equals it. Returns the base64 payload `otp/request` expects.
 */
export async function solveAltcha(signal?: AbortSignal): Promise<string> {
  const response = await fetch("/api/auth/altcha", { cache: "no-store", signal });
  if (!response.ok) throw new Error("altcha.challenge");
  const c = (await response.json()) as Challenge;
  for (let n = 0; n <= c.maxNumber; n++) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    if ((await sha256Hex(c.salt + n)) === c.challenge) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    }
  }
  throw new Error("altcha.unsolved");
}
