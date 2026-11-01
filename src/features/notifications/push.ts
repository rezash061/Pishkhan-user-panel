"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

/**
 * Web push (BE-1.14): one subscription per browser, stored for the user (not per workspace), at most 10.
 * The backend answers 404 `push.unavailable` for the key when push is not configured; the toggle is hidden then.
 */
export type PushSupport = "supported" | "unsupported" | "ios-install";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  // iOS only offers push to web apps added to the home screen (16.4+).
  if (ios && !standalone) return "ios-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "supported" : "unsupported";
}

/** VAPID keys are base64url; PushManager wants the raw bytes. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const keys = {
  key: ["push", "key"] as const,
  subscriptions: ["push", "subscriptions"] as const,
  current: ["push", "current"] as const,
};

/** The VAPID key, or null when the server has no push configured. */
export function usePushKey() {
  return useQuery({
    queryKey: keys.key,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      try {
        return unwrap(await api.GET("/api/v1/me/push/key")).publicKey;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export function usePushSubscriptions(enabled: boolean) {
  return useQuery({ queryKey: keys.subscriptions, enabled, queryFn: async () => unwrap(await api.GET("/api/v1/me/push-subscriptions")) });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // The worker is registered by ServiceWorkerRegister in production; register here too so the toggle never waits forever.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** This browser's subscription endpoint, if it has one. */
export function useCurrentPush(enabled: boolean) {
  return useQuery({
    queryKey: keys.current,
    enabled,
    queryFn: async () => (await (await registration()).pushManager.getSubscription())?.endpoint ?? null,
  });
}

export class PushPermissionDenied extends Error {}

export function useEnablePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (publicKey: string) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new PushPermissionDenied();
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
      const json = sub.toJSON();
      try {
        unwrap(await api.PUT("/api/v1/me/push-subscriptions", { body: { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } } }));
      } catch (err) {
        // A subscription the server refused is useless; drop it so the next try starts clean.
        await sub.unsubscribe().catch(() => undefined);
        throw err;
      }
      return sub.endpoint;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.current });
      void qc.invalidateQueries({ queryKey: keys.subscriptions });
    },
  });
}

/** Removes a browser. For this browser the local subscription is dropped too. */
export function useRemovePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ endpoint, local }: { endpoint: string; local: boolean }) => {
      if (local) {
        const sub = await (await registration()).pushManager.getSubscription();
        await sub?.unsubscribe().catch(() => undefined);
      }
      unwrap(await api.DELETE("/api/v1/me/push-subscriptions", { params: { query: { endpoint } } }));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.current });
      void qc.invalidateQueries({ queryKey: keys.subscriptions });
    },
  });
}

/** «Chrome on Android» from a user agent, good enough to tell a member's browsers apart. */
export function describeAgent(ua: string | null): { browser: string; os: string } | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return browser || os ? { browser, os } : null;
}
