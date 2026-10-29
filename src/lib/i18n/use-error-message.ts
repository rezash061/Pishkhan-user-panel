"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/errors";

/** Turns an error (ApiError code, HTTP status, network failure) into a Persian sentence from the `errors` catalog. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      if (t.has(error.code)) return t(error.code);
      const status = `http.${error.status}`;
      if (t.has(status)) return t(status);
      return t("generic");
    }
    if (error instanceof TypeError) return t("network");
    return t("generic");
  };
}

/** Message for a single code (field errors, message error codes), or null when the catalog has none. */
export function useCodeMessage() {
  const t = useTranslations("errors");
  return (code: string | null | undefined): string | null => (code && t.has(code) ? t(code) : null);
}
