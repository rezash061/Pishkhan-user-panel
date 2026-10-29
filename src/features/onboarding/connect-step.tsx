"use client";

import { ShieldCheck } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { startInstagramConnect } from "@/features/channels/connect";
import { OAuthResult } from "@/features/channels/oauth-result";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { Stepper } from "./stepper";

export function ConnectInstagramStep({ workspaceId, status, reason }: { workspaceId: string; status: string | null; reason: string | null }) {
  const t = useTranslations("onboarding.connect");
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = status === "connected";

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await startInstagramConnect(workspaceId, "onboarding");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Stepper step={2} />
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OAuthResult status={status} reason={reason} />
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {connected ? (
        <Link href={`/w/${workspaceId}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
          {t("done")}
        </Link>
      ) : (
        <>
          <Card>
            <CardBody className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                {t("noPassword")}
              </p>
              <p className="text-muted-foreground">{t("requirements")}</p>
              <details className="rounded-xl bg-surface-muted p-3">
                <summary className="cursor-pointer font-medium">{t("howToSwitch")}</summary>
                <p className="mt-2 text-muted-foreground">{t("howToSwitchBody")}</p>
              </details>
            </CardBody>
          </Card>
          <Button size="lg" className="w-full" onClick={connect} loading={busy}>
            {busy ? null : <InstagramIcon />}
            {busy ? t("connecting") : t("button")}
          </Button>
          <Link href={`/w/${workspaceId}`} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
            {t("skip")}
          </Link>
        </>
      )}
    </div>
  );
}
