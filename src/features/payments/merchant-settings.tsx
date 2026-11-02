"use client";

import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { MerchantAccount } from "@/lib/api/types";
import { toLatinDigits } from "@/lib/i18n/digits";
import { formatDateTime } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { merchantIdPattern, useDisconnectMerchant, useMerchantAccount, useSaveMerchantAccount } from "./data";

/**
 * «پرداخت» settings (BE-2.2): the seller's own Zarinpal merchant account. Customers pay the seller directly; the
 * merchant ID is stored encrypted and only its last four characters come back.
 */
export function MerchantSettings() {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const account = useMerchantAccount(workspace.id);
  if (account.isPending) return <Skeleton className="h-64" />;
  if (account.isError) return <p className="text-sm text-danger">{errorMessage(account.error)}</p>;
  return <MerchantForm key={account.data.updatedAt ?? "new"} account={account.data} />;
}

function MerchantForm({ account }: { account: MerchantAccount }) {
  const t = useTranslations("payments.merchant");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace, can } = useWorkspace();
  const writable = can(P.settingsWrite);
  const save = useSaveMerchantAccount(workspace.id);
  const disconnect = useDisconnectMerchant(workspace.id);
  const [merchantId, setMerchantId] = useState("");
  const [sandbox, setSandbox] = useState(account.sandbox);
  const [enabled, setEnabled] = useState(account.configured ? account.enabled : true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = toLatinDigits(merchantId).trim();
    if (!account.configured && !id) return setError(t("required"));
    if (id && !merchantIdPattern.test(id)) return setError(t("invalid"));
    save.mutate(
      { provider: "zarinpal", merchantId: id || null, sandbox, enabled },
      {
        onSuccess: () => {
          setMerchantId("");
          toast.success(account.configured ? t("updated") : t("connected"));
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.field("merchantId") : undefined;
          if (code) return setError(codeMessage(code) ?? t("invalid"));
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("title")}
            {account.configured ? <Badge tone={account.enabled ? "success" : "neutral"}>{account.enabled ? t("active") : t("paused")}</Badge> : <Badge>{t("notConnected")}</Badge>}
            {account.configured && account.sandbox ? <Badge tone="warning">{t("sandbox")}</Badge> : null}
          </span>
        }
        description={t("hint")}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          {account.configured ? (
            <p className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden />
              <span>{t("current")}</span>
              <span dir="ltr" className="font-mono">
                ••••{account.merchantIdHint}
              </span>
              {account.updatedAt ? <span className="text-xs text-muted-foreground">{t("updatedAt", { when: formatDateTime(account.updatedAt) })}</span> : null}
            </p>
          ) : null}
          {writable ? (
            <>
              <Field label={account.configured ? t("replaceId") : t("merchantId")} htmlFor="merchant-id" error={error ?? undefined} hint={account.configured ? t("replaceHint") : t("idHint")}>
                <Input
                  id="merchant-id"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={36}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="font-mono"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  aria-invalid={Boolean(error) || undefined}
                />
              </Field>
              <div className="space-y-3 rounded-xl border p-3">
                <label className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-medium">{t("enabled")}</span>
                    <span className="text-xs text-muted-foreground">{t("enabledHint")}</span>
                  </span>
                  <Switch checked={enabled} onChange={setEnabled} label={t("enabled")} />
                </label>
                <label className="flex items-start justify-between gap-3 border-t pt-3 text-sm">
                  <span>
                    <span className="block font-medium">{t("sandboxLabel")}</span>
                    <span className="text-xs text-muted-foreground">{t("sandboxHint")}</span>
                  </span>
                  <Switch checked={sandbox} onChange={setSandbox} label={t("sandboxLabel")} />
                </label>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button type="submit" loading={save.isPending}>
                  {account.configured ? t("save") : t("connect")}
                </Button>
                {account.configured ? (
                  <Button variant="ghost" className="text-danger" onClick={() => setConfirming(true)}>
                    {t("disconnect")}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
          )}
        </form>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        danger
        title={t("disconnectTitle")}
        body={t("disconnectBody")}
        confirmLabel={t("disconnect")}
        loading={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false);
              toast.success(t("disconnected"));
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </Card>
  );
}
