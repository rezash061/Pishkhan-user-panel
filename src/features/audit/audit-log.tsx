"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Headset, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { AuditEntry } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

const PAGE_SIZE = 20;
/** The backend matches `Action` as "contains", so a prefix picks a whole group. */
const groups = { all: "", support: "support_session", team: "member.", workspace: "workspace." } as const;
type Group = keyof typeof groups;

/** Known actions get a Persian sentence; anything newer shows its code, so nothing is hidden. */
const knownActions = new Set([
  "workspace.create",
  "workspace.update",
  "workspace.business_hours_update",
  "workspace.deletion_request",
  "workspace.deletion_cancel",
  "member.invite",
  "member.join",
  "member.role_change",
  "member.remove",
  "member.leave",
  "member.invitation_revoke",
  "support_session.grant",
  "support_session.start",
]);

function useAuditLog(ws: string, group: Group, page: number) {
  return useQuery({
    queryKey: qk.audit(ws, { group, page }),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/audit", {
          params: { path: { workspaceId: ws }, query: { Action: groups[group] || undefined, Page: page, PageSize: PAGE_SIZE } },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

/** Owner-only log of who changed what. Support staff show as «پشتیبانی پیشخوان», with the reason they gave. */
export function AuditLog() {
  const t = useTranslations("audit");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const [group, setGroup] = useState<Group>("all");
  const [page, setPage] = useState(1);
  const log = useAuditLog(workspace.id, group, page);
  const pages = log.data ? Math.max(1, Math.ceil(log.data.totalCount / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader title={t("title")} description={t("subtitle")} />
      <CardBody className="space-y-4">
        <Field label={t("filter")} htmlFor="audit-group" className="max-w-xs">
          <Select
            id="audit-group"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value as Group);
              setPage(1);
            }}
          >
            {(Object.keys(groups) as Group[]).map((g) => (
              <option key={g} value={g}>
                {t(`groups.${g}`)}
              </option>
            ))}
          </Select>
        </Field>

        {log.isPending ? (
          <Skeleton className="h-64" />
        ) : log.isError ? (
          <p className="text-sm text-danger">{errorMessage(log.error)}</p>
        ) : log.data.items.length === 0 ? (
          <EmptyState icon={<History />} title={t("empty")} body={group === "all" ? t("emptyBody") : undefined} />
        ) : (
          <ol className={cn("divide-y rounded-xl border", log.isPlaceholderData && "opacity-60")} aria-busy={log.isPlaceholderData || undefined}>
            {log.data.items.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </ol>
        )}

        {log.data && pages > 1 ? (
          <nav aria-label={t("pages")} className="flex items-center justify-between gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronRight aria-hidden />
              {t("newer")}
            </Button>
            <span className="text-muted-foreground">{t("pageOf", { page: toPersianDigits(page), pages: toPersianDigits(pages), total: formatNumber(log.data.totalCount) })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t("older")}
              <ChevronLeft aria-hidden />
            </Button>
          </nav>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const t = useTranslations("audit");
  const staff = entry.actorType === "staff" || entry.action.startsWith("support_session.");
  const actor = entry.actorType === "staff" ? t("supportActor") : entry.actorName || t("system");
  const changes = diff(entry.before, entry.after);
  const sentence = knownActions.has(entry.action) ? t(`actions.${entry.action.replace(".", "_")}` as "actions.workspace_create", { actor }) : t("unknown", { actor, action: entry.action });

  return (
    <li className="flex gap-3 p-3 sm:p-4">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", staff ? "bg-danger-soft text-danger" : "bg-surface-muted text-muted-foreground")}>
        {staff ? <Headset aria-hidden /> : <History aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">
          {sentence}
          {staff ? <Badge className="ms-2 align-middle">{t("supportBadge")}</Badge> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt)}</time>
        </p>
        {entry.reason ? <p className="text-sm text-muted-foreground">{t("reason", { reason: entry.reason })}</p> : null}
        {changes.length > 0 ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-primary">{t("details", { count: changes.length })}</summary>
            <dl className="mt-2 space-y-1 rounded-lg bg-surface-muted p-2">
              {changes.map((c) => (
                <div key={c.key} className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">{c.key}</dt>
                  <dd className="min-w-0 break-words text-muted-foreground" dir="auto">
                    {c.before !== undefined ? <del className="me-1">{show(c.before)}</del> : null}
                    {c.after !== undefined ? <ins className="no-underline text-foreground">{show(c.after)}</ins> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  );
}

type Json = unknown;

function asObject(value: Json): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : null;
}

/** Top-level fields that differ between the before and after snapshots (secrets arrive already redacted). */
export function diff(before: Json, after: Json): { key: string; before?: Json; after?: Json }[] {
  const b = asObject(before);
  const a = asObject(after);
  if (!b && !a) return [];
  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])];
  return keys
    .filter((k) => JSON.stringify(b?.[k]) !== JSON.stringify(a?.[k]))
    .map((k) => ({ key: k, ...(b && k in b ? { before: b[k] } : {}), ...(a && k in a ? { after: a[k] } : {}) }));
}

function show(value: Json): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
