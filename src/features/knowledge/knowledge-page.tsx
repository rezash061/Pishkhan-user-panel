"use client";

import { BookOpen, FileText, FileUp, Globe, MessageCircleQuestion, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { api, unwrap } from "@/lib/api/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton, Switch } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import type { KnowledgeSource } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { isExtracted, isIndexing, limits, sourceKinds, sourceStatuses, useDeleteSource, useKnowledgeSearch, useReindexSource, useSources, useToggleSource, type SourceKind } from "./data";
import { ExtractedSourceDialog } from "./extracted-dialog";
import { SourceDialog } from "./source-dialog";
import { useKnowledgeScore } from "./score-data";
import { KnowledgeTabs } from "./tabs";

const kindIcons = { faq: MessageCircleQuestion, text: FileText, file: FileUp, url: Globe, product: Package } as const;

/**
 * Knowledge base (BE-1.4): what the AI agent may answer from. FAQ entries and free text are written here, documents
 * and web pages are read by the backend; active catalog products are added on their own and can only be switched off.
 */
export function KnowledgePage({ openSource }: { openSource?: string | null }) {
  const t = useTranslations("knowledge");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ kind: "faq" | "text" | "file" | "url"; source: KnowledgeSource | null } | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeSource | null>(null);
  const sources = useSources(ws, { q: query, kind, status });
  const del = useDeleteSource(ws);
  const items = sources.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(query || kind || status);

  // `?source=` (from the knowledge score's checklist) opens that source's editor.
  useEffect(() => {
    if (!openSource) return;
    let live = true;
    void api.GET("/api/v1/workspaces/{workspaceId}/knowledge/sources/{sourceId}", { params: { path: { workspaceId: ws, sourceId: openSource } } }).then((r) => {
      if (!live || !r.data) return;
      const s = unwrap(r);
      setEditing({ kind: s.kind === "faq" || isExtracted(s.kind) ? (s.kind as "faq" | "file" | "url") : "text", source: s });
    });
    return () => {
      live = false;
    };
  }, [openSource, ws]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing({ kind: "faq", source: null })}>
              <Plus aria-hidden />
              {t("newFaq")}
            </Button>
            <Button variant="outline" onClick={() => setEditing({ kind: "text", source: null })}>
              <Plus aria-hidden />
              {t("newText")}
            </Button>
            <Button variant="outline" onClick={() => setEditing({ kind: "file", source: null })}>
              <FileUp aria-hidden />
              {t("newFile")}
            </Button>
            <Button variant="outline" onClick={() => setEditing({ kind: "url", source: null })}>
              <Globe aria-hidden />
              {t("newUrl")}
            </Button>
          </div>
        }
      />
      <KnowledgeTabs />

      <TestBox />

      <section aria-labelledby="kb-sources" className="space-y-3">
        <h2 id="kb-sources" className="sr-only">
          {t("sources")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label={t("search")} placeholder={t("searchPlaceholder")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select aria-label={t("filters.kind")} className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("filters.allKinds")}</option>
            {sourceKinds.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </Select>
          <Select aria-label={t("filters.status")} className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("filters.allStatuses")}</option>
            {sourceStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
        </div>

        <Card className={cn("divide-y overflow-hidden", sources.isPlaceholderData && "opacity-60")}>
          {sources.isPending ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : sources.isError ? (
            <EmptyState title={errorMessage(sources.error)} action={<Button variant="outline" onClick={() => sources.refetch()}>{t("retry")}</Button>} />
          ) : items.length === 0 ? (
            filtered ? <EmptyState icon={<Search />} title={t("noResults")} /> : <EmptyState icon={<BookOpen />} title={t("empty")} body={t("emptyBody")} />
          ) : (
            items.map((s) => <SourceRow key={s.id} source={s} onEdit={() => setEditing({ kind: s.kind === "faq" || isExtracted(s.kind) ? (s.kind as "faq" | "file" | "url") : "text", source: s })} onDelete={() => setDeleting(s)} />)
          )}
        </Card>
        {sources.hasNextPage ? (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => sources.fetchNextPage()} loading={sources.isFetchingNextPage}>
              {t("loadMore")}
            </Button>
          </div>
        ) : null}
      </section>

      {editing ? (
        editing.kind === "file" || editing.kind === "url" ? (
          <ExtractedSourceDialog key={editing.source?.id ?? editing.kind} kind={editing.kind} source={editing.source} onClose={() => setEditing(null)} />
        ) : (
          <SourceDialog key={editing.source?.id ?? editing.kind} kind={editing.kind} source={editing.source} onClose={() => setEditing(null)} />
        )
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteTitle", { title: deleting?.title ?? "" })}
        body={t("deleteBody")}
        confirmLabel={t("delete")}
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setDeleting(null);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </PageContainer>
  );
}

function StatusBadge({ source: s }: { source: KnowledgeSource }) {
  const t = useTranslations("knowledge");
  if (isIndexing(s)) return <Badge tone="primary">{t("status.pending")}</Badge>;
  if (s.status === "failed") return <Badge tone="danger">{t("status.failed")}</Badge>;
  return <Badge tone="success">{t("status.indexed")}</Badge>;
}

function SourceRow({ source: s, onEdit, onDelete }: { source: KnowledgeSource; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations("knowledge");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace, can } = useWorkspace();
  const toggle = useToggleSource(workspace.id);
  const reindex = useReindexSource(workspace.id);
  const kind = (sourceKinds as readonly string[]).includes(s.kind) ? (s.kind as SourceKind) : "text";
  const Icon = kindIcons[kind];
  const product = kind === "product";

  return (
    <div className={cn("flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap sm:p-4", !s.enabled && "bg-surface-muted/40")}>
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" title={t(`kinds.${kind}`)}>
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{t(`kinds.${kind}`)}</span>
      </span>
      <div className="min-w-0 flex-1 basis-48 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("font-medium", !s.enabled && "text-muted-foreground")} dir="auto">
            {s.title}
          </span>
          <StatusBadge source={s} />
          {s.factKey ? <FactBadge factKey={s.factKey} /> : null}
          {!s.enabled ? <Badge>{t("off")}</Badge> : null}
        </p>
        {s.kind === "url" && s.url ? (
          <a href={s.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="block truncate text-sm text-primary underline underline-offset-2">
            {s.url}
          </a>
        ) : null}
        {s.body ? (
          <p className="line-clamp-2 text-sm text-muted-foreground" dir="auto">
            {s.body}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {s.status === "failed" && s.error ? (
            <span className="text-danger">{codeMessage(s.error) ?? t("failedHint")}</span>
          ) : isIndexing(s) ? (
            t("indexingHint")
          ) : (
            t("chunks", { n: formatNumber(s.chunkCount) })
          )}
          {" · "}
          {t("updated", { when: formatRelative(s.updatedAt) })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={s.enabled}
          label={t("enabledFor", { title: s.title })}
          disabled={toggle.isPending}
          onChange={(enabled) => toggle.mutate({ id: s.id, enabled }, { onSuccess: () => toast.success(t(enabled ? "turnedOn" : "turnedOff")), onError: (err) => toast.error(errorMessage(err)) })}
        />
        {s.status === "failed" || (s.kind === "url" && !isIndexing(s)) ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(s.kind === "url" ? "refetchFor" : "reindexFor", { title: s.title })}
            title={t(s.kind === "url" ? "refetch" : "reindex")} 
            loading={reindex.isPending}
            onClick={() => reindex.mutate(s.id, { onSuccess: () => (s.kind === "url" ? toast.success(t("refetching")) : undefined), onError: (err) => toast.error(errorMessage(err)) })}
          >
            <RefreshCw aria-hidden />
          </Button>
        ) : null}
        {product ? (
          s.productId && can(P.catalogRead) ? (
            <Link href={`/w/${workspace.id}/catalog/products/${s.productId}`} className="px-2 text-sm text-primary underline underline-offset-2">
              {t("openProduct")}
            </Link>
          ) : null
        ) : (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={t("editFor", { title: s.title })} onClick={onEdit}>
              <Pencil aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("deleteFor", { title: s.title })} onClick={onDelete}>
              <Trash2 aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** «از دانش بپرسید»: runs the same hybrid search the agent uses, so owners can see what it would find. */
function TestBox() {
  const t = useTranslations("knowledge.test");
  const tk = useTranslations("knowledge");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const search = useKnowledgeSearch(workspace.id);
  const [query, setQuery] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) search.mutate(query.trim());
  };

  return (
    <Card>
      <CardHeader title={t("title")} description={t("hint")} />
      <CardBody className="space-y-3">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input aria-label={t("label")} placeholder={t("placeholder")} dir="auto" maxLength={limits.query} className="min-w-48 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit" variant="secondary" loading={search.isPending} disabled={!query.trim()}>
            <Search aria-hidden />
            {t("run")}
          </Button>
        </form>
        <div aria-live="polite">
          {search.isError ? (
            <p className="text-sm text-danger">{errorMessage(search.error)}</p>
          ) : search.data ? (
            search.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              <ol className="space-y-2">
                {search.data.map((h, i) => {
                  const kind = (sourceKinds as readonly string[]).includes(h.sourceKind) ? (h.sourceKind as SourceKind) : "text";
                  return (
                    <li key={h.chunkId} className="rounded-xl border p-3">
                      <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{toPersianDigits(i + 1)}.</span>
                        <span className="font-medium" dir="auto">
                          {h.title}
                        </span>
                        <Badge>{tk(`kinds.${kind}`)}</Badge>
                        {h.similarity !== null ? <span className="text-xs text-muted-foreground">{t("similarity", { n: toPersianDigits(Math.round(h.similarity * 100)) })}</span> : null}
                      </p>
                      <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground" dir="auto">
                        {h.text}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

/** The required fact a source answers (`factKey`), by its label from the knowledge score when it is loaded. */
function FactBadge({ factKey }: { factKey: string }) {
  const t = useTranslations("knowledge.score");
  const { workspace } = useWorkspace();
  const score = useKnowledgeScore(workspace.id);
  const label = score.data?.facts.find((f) => f.key === factKey)?.label;
  return (
    <Badge tone="primary" title={t("factBadgeHint")}>
      {label ? t("factBadge", { label }) : t("factBadgeKey")}
    </Badge>
  );
}
