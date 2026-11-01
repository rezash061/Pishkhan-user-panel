"use client";

import { Check, CircleHelp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { useMembers } from "@/features/team/data";
import { useWorkspace } from "@/features/workspace/context";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { consentChannels, useConsents, useRecordConsent, type ConsentChannel } from "./data";

const HISTORY_SHOWN = 5;

/**
 * Marketing consent per channel (BE-1.7 part 2). Only the history is stored; the current state is the latest decision.
 * A channel with no decision is «unknown», which is not the same as refused.
 */
export function ConsentCard({ contactId, writable }: { contactId: string; writable: boolean }) {
  const t = useTranslations("contacts.consent");
  const errorMessage = useErrorMessage();
  const { workspace, me } = useWorkspace();
  const consents = useConsents(workspace.id, contactId);
  const members = useMembers(workspace.id);
  const [editing, setEditing] = useState<{ channel: ConsentChannel; granted: boolean } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const who = (id: string | null) => (!id ? null : id === me.id ? t("you") : (members.data?.find((m) => m.userId === id)?.displayName ?? null));
  const history = consents.data?.history ?? [];

  return (
    <Card>
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody className="space-y-4">
        {consents.isPending ? (
          <Skeleton className="h-24" />
        ) : consents.isError ? (
          <p className="text-sm text-danger">{errorMessage(consents.error)}</p>
        ) : (
          <>
            <ul className="divide-y rounded-xl border">
              {consentChannels.map((ch) => {
                const state = consents.data.current[ch];
                const Icon = state === true ? Check : state === false ? X : CircleHelp;
                return (
                  <li key={ch} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="min-w-24 font-medium">{t(`channels.${ch}`)}</span>
                    <span className={cn("inline-flex flex-1 items-center gap-1 text-sm", state === true ? "text-success" : state === false ? "text-danger" : "text-muted-foreground")}>
                      <Icon className="size-4" aria-hidden />
                      {t(state === true ? "granted" : state === false ? "revoked" : "unknown")}
                    </span>
                    {writable ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing({ channel: ch, granted: state !== true })} aria-label={t(state === true ? "revokeFor" : "grantFor", { channel: t(`channels.${ch}`) })}>
                        {t(state === true ? "revoke" : "grant")}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {history.length > 0 ? (
              <section aria-labelledby="consent-history" className="space-y-2">
                <h3 id="consent-history" className="text-xs font-semibold text-muted-foreground">
                  {t("history")}
                </h3>
                <ul className="space-y-2">
                  {(showAll ? history : history.slice(0, HISTORY_SHOWN)).map((h) => {
                    const by = who(h.recordedBy);
                    return (
                      <li key={h.id} className="text-sm">
                        <p>
                          {t(h.granted ? "historyGranted" : "historyRevoked", { channel: t.has(`channels.${h.channel}`) ? t(`channels.${h.channel}` as "channels.sms") : h.channel })}
                          <span className="text-muted-foreground">
                            {" · "}
                            <time dateTime={h.createdAt} title={formatDateTime(h.createdAt)}>
                              {formatRelative(h.createdAt)}
                            </time>
                            {" · "}
                            {by ? t("by", { name: by }) : t.has(`sources.${h.source}`) ? t(`sources.${h.source}` as "sources.manual") : h.source}
                          </span>
                        </p>
                        {h.evidence ? (
                          <p className="whitespace-pre-wrap text-xs text-muted-foreground" dir="auto">
                            {h.evidence}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {history.length > HISTORY_SHOWN ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? t("showLess") : t("showAll")}
                  </Button>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </CardBody>
      {editing ? <ConsentDialog key={`${editing.channel}-${editing.granted}`} contactId={contactId} channel={editing.channel} granted={editing.granted} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function ConsentDialog({ contactId, channel, granted, onClose }: { contactId: string; channel: ConsentChannel; granted: boolean; onClose: () => void }) {
  const t = useTranslations("contacts.consent");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const record = useRecordConsent(workspace.id, contactId);
  const [evidence, setEvidence] = useState("");
  const name = t(`channels.${channel}`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    record.mutate(
      { channel, granted, evidence: evidence.trim() || null },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(granted ? "grantTitle" : "revokeTitle", { channel: name })}
      description={t(granted ? "grantBody" : "revokeBody")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="consent-form" variant={granted ? "primary" : "danger"} loading={record.isPending}>
            {t(granted ? "grant" : "revoke")}
          </Button>
        </>
      }
    >
      <form id="consent-form" onSubmit={submit}>
        <Field label={t("evidence")} htmlFor="consent-evidence" hint={t("evidenceHint")}>
          <Textarea id="consent-evidence" dir="auto" maxLength={500} className="min-h-20" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
