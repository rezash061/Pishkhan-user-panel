"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Send } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BaleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useWorkspace } from "@/features/workspace/context";
import { newLocalMessage, useSendMessage } from "@/features/inbox/data";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/keys";
import { formatDate } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

/** A Bale bot token as BotFather gives it: the bot's numeric id, a colon, then the secret. */
export const baleTokenPattern = /^\d{5,15}:[A-Za-z0-9_-]{20,}$/;

export function useConnectBale(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (botToken: string) => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/channels/bale/connect", { params: { path: { workspaceId: ws } }, body: { botToken: botToken.trim() } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.channels(ws) }),
  });
}

/** A one-time `https://ble.ir/{bot}?start={token}` link for one contact, valid 14 days. */
export function useBaleLink(ws: string, contactId: string) {
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/contacts/{contactId}/bale-link", { params: { path: { workspaceId: ws, contactId } } })),
  });
}

/** «اتصال بله» (BE-2.7 part 2): connect the seller's own Bale bot with its BotFather token. */
export function ConnectBaleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("channels.bale");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const connect = useConnectBale(workspace.id);
  const [token, setToken] = useState("");
  const looksValid = baleTokenPattern.test(token.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!looksValid) return;
    connect.mutate(token, {
      onSuccess: (c) => {
        toast.success(t("connected", { username: c.username ?? c.displayName ?? "" }));
        setToken("");
        onClose();
      },
    });
  };
  // A 402 plan limit also opens the upgrade sheet on its own (PlanLimitProvider).
  const error = connect.error ? errorMessage(connect.error) : null;

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} description={t("subtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <ol className="list-inside list-decimal space-y-1.5 text-sm">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
        <Field label={t("token")} htmlFor="bale-token" hint={t("tokenHint")} error={token.trim() && !looksValid ? t("tokenFormat") : error}>
          <Input id="bale-token" dir="ltr" autoComplete="off" spellCheck={false} className="font-mono" value={token} placeholder="1234567890:AbCdEf…" onChange={(e) => setToken(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={connect.isPending} disabled={!looksValid}>
            <BaleIcon className="size-4" />
            {t("connect")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * «دعوت به بله»: a one-time link (14 days) to the shop's Bale bot. When the customer presses start, their Bale chat joins
 * this same contact. With `sendIn` (an Instagram conversation whose window is open) the link can go straight into it.
 */
export function BaleInvite({ contactId, sendIn }: { contactId: string; sendIn?: { conversationId: string; windowOpen: boolean } | null }) {
  const t = useTranslations("channels.baleLink");
  const errorMessage = useErrorMessage();
  const { workspace, me } = useWorkspace();
  const link = useBaleLink(workspace.id, contactId);
  const send = useSendMessage(workspace.id, sendIn?.conversationId ?? "", me.id);
  const [sent, setSent] = useState(false);
  const notConnected = link.error instanceof ApiError && link.error.code === "channels.bale_not_connected";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  if (!link.data) {
    return (
      <div className="space-y-2">
        <Button size="sm" variant="outline" loading={link.isPending} onClick={() => link.mutate()}>
          <BaleIcon className="size-4" />
          {t("create")}
        </Button>
        {link.error ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(link.error)}{" "}
            {notConnected ? (
              <Link href={`/w/${workspace.id}/channels`} className="underline underline-offset-2">
                {t("connectBot")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  }

  const url = link.data.url;
  const message = t("message", { url });
  const sendInChat = () =>
    send.mutate(
      { text: message, ...newLocalMessage() },
      {
        onSuccess: () => {
          setSent(true);
          toast.success(t("sent"));
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="space-y-2 rounded-xl border p-3 text-sm">
      <label htmlFor={`bale-link-${contactId}`} className="font-medium">
        {t("title")}
      </label>
      <input id={`bale-link-${contactId}`} readOnly dir="ltr" value={url} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full rounded-xl border bg-surface-muted px-3 font-mono text-xs" />
      <p className="text-xs text-muted-foreground">{t("explain", { date: formatDate(link.data.expiresAt) })}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => copy(url)}>
          <Copy aria-hidden />
          {t("copyLink")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => copy(message)}>
          <Copy aria-hidden />
          {t("copyMessage")}
        </Button>
        {sendIn?.windowOpen ? (
          <Button size="sm" disabled={sent} loading={send.isPending} onClick={sendInChat}>
            <Send aria-hidden />
            {sent ? t("sentLabel") : t("sendInChat")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
