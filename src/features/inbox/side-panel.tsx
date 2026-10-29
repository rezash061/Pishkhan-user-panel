"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { InstagramIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import type { Conversation, Member } from "@/lib/api/types";
import { formatCountdown, formatDateTime, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { contactLabel } from "./contact";
import { useAddNote, useNotes } from "./data";
import { messagingWindow } from "./window";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

/** Context next to the thread: contact, channel, assignment, window, and internal notes (plan 3.3 side panel). */
export function SidePanel({ conversation: c, members, canReply, onAssign, idPrefix }: { conversation: Conversation; members: Member[]; canReply: boolean; onAssign: (userId: string | null) => void; idPrefix: string }) {
  const t = useTranslations("inbox");
  const { workspace, me } = useWorkspace();
  const channels = useChannels(workspace.id);
  const channel = channels.data?.find((ch) => ch.id === c.channelAccountId);
  const win = messagingWindow(c);

  return (
    <div className="space-y-5 p-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t("side.contact")}</h3>
        <dl className="divide-y">
          <Row label={t("side.contact")}>{t("customer", { id: contactLabel(c.contactId) })}</Row>
          <Row label={t("side.channel")}>
            <span className="inline-flex items-center gap-1" dir="ltr">
              <InstagramIcon className="size-3.5" />@{channel?.username ?? "…"}
            </span>
          </Row>
          <Row label={t("side.status")}>{t(`status.${c.status}` as "status.open")}</Row>
          <Row label={t("side.lastMessage")}>{c.lastInboundAt ? <span title={formatDateTime(c.lastInboundAt)}>{formatRelative(c.lastInboundAt)}</span> : "—"}</Row>
          <Row label={t("side.window")}>
            {win.kind === "open" ? formatCountdown(win.until) : win.kind === "human" ? t("side.windowHuman", { time: formatCountdown(win.until) ?? "" }) : win.kind === "closed" ? t("side.windowClosed") : "—"}
          </Row>
        </dl>
      </section>

      <section>
        <label htmlFor={`${idPrefix}-assignee`} className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {t("side.assignee")}
        </label>
        <Select id={`${idPrefix}-assignee`} value={c.assigneeId ?? ""} disabled={!canReply} onChange={(e) => onAssign(e.target.value || null)}>
          <option value="">{t("actions.unassign")}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userId === me.id ? `${m.displayName ?? ""} (${t("handledBy.you")})` : (m.displayName ?? m.phone ?? m.userId.slice(0, 8))}
            </option>
          ))}
        </Select>
      </section>

      <Notes conversationId={c.id} canWrite={canReply} members={members} idPrefix={idPrefix} />
    </div>
  );
}

function Notes({ conversationId, canWrite, members, idPrefix }: { conversationId: string; canWrite: boolean; members: Member[]; idPrefix: string }) {
  const t = useTranslations("inbox.side");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { workspace, me } = useWorkspace();
  const notes = useNotes(workspace.id, conversationId);
  const add = useAddNote(workspace.id, conversationId);
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add.mutate(text.trim(), { onSuccess: () => setText(""), onError: (err) => toast.error(errorMessage(err)) });
  };

  const author = (id: string) => (id === me.id ? tc("you") : (members.find((m) => m.userId === id)?.displayName ?? "—"));

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t("notes")}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{t("notesHint")}</p>
      <div className="mb-3 space-y-2">
        {notes.isPending ? <Skeleton className="h-12" /> : null}
        {notes.data?.length === 0 ? <p className="text-sm text-muted-foreground">{t("noNotes")}</p> : null}
        {notes.data?.map((n) => (
          <div key={n.id} className="rounded-xl bg-warning-soft/70 p-2.5 text-sm">
            <p className="whitespace-pre-wrap" dir="auto">
              {n.text}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {author(n.authorId)} · {formatRelative(n.createdAt)}
            </p>
          </div>
        ))}
      </div>
      {canWrite ? (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor={`${idPrefix}-note`} className="sr-only">
            {t("addNote")}
          </label>
          <Textarea id={`${idPrefix}-note`} className="min-h-16" maxLength={2000} placeholder={t("notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="sm" variant="secondary" loading={add.isPending} disabled={!text.trim()}>
            {t("addNote")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
