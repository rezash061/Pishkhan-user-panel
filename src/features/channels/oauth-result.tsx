"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** Persian explanation of the OAuth return (`status` and `reason` query parameters from the backend callback). */
export function OAuthResult({ status, reason, username }: { status: string | null; reason: string | null; username?: string | null }) {
  const t = useTranslations();
  if (!status) return null;
  if (status === "connected") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {username ? t("onboarding.connect.connected", { username }) : t("onboarding.connect.connectedNoName")}
      </p>
    );
  }
  // `reason` is either a callback reason (oauth.reason.*) or a backend error code such as instagram.unreachable (errors.*).
  const own = `oauth.reason.${reason ?? ""}` as "oauth.error";
  const code = `errors.${reason ?? ""}` as "oauth.error";
  const detail = !reason ? null : !reason.includes(".") && t.has(own) ? t(own) : t.has(code) ? t(code) : null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{status === "denied" ? t("oauth.denied") : t("oauth.error")}</p>
        {detail && status !== "denied" ? <p>{detail}</p> : null}
      </div>
    </div>
  );
}
