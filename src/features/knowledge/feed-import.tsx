"use client";

import { AlertTriangle, Check, ExternalLink, ImageOff, Loader2, MessageCircleQuestion, Package, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ChipsInput } from "@/components/ui/chips-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { MoneyInput } from "@/components/ui/money-input";
import { useChannels } from "@/features/channels/data";
import { ApiError } from "@/lib/api/errors";
import type { FeedImport, FeedItem } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber, formatRelative, formatToman } from "@/lib/i18n/format";
import { rialOf } from "@/lib/money";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { useAcceptFeedItem, useAcceptFeedItems, useFeedImport, useRejectFeedItem, useStartFeedImport, useUpdateFeedItem } from "./feed-data";
import { acceptOutcome, clampPosts, draftOf, FEED_ACCEPT_BATCH, FEED_DEFAULT_POSTS, FEED_MAX_POSTS, groupByPost, isPending, sameDraft, updateOf, type ItemDraft, type PostGroup } from "./feed-model";

/**
 * Start a feed import (BE-2.5): pick a connected Instagram account and how many recent posts to read. Nothing reaches
 * customers until the owner accepts a suggestion. `onStarted` gets the new import.
 */
export function FeedImportStart({ ws, onStarted, runningId }: { ws: string; onStarted: (imp: FeedImport) => void; runningId?: string | null }) {
  const t = useTranslations("knowledge.feed");
  const errorMessage = useErrorMessage();
  const channels = useChannels(ws);
  const start = useStartFeedImport(ws);
  const accounts = (channels.data ?? []).filter((c) => c.kind === "instagram" && c.status !== "disconnected");
  const [account, setAccount] = useState<string>("");
  const [posts, setPosts] = useState(String(FEED_DEFAULT_POSTS));
  const chosen = account || accounts[0]?.id || "";

  if (channels.isPending) return <Skeleton className="h-40" />;
  if (!accounts.length) return <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("noAccount")}</p>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const maxPosts = clampPosts(Number(posts));
    setPosts(String(maxPosts));
    start.mutate({ channelAccountId: chosen, maxPosts }, { onSuccess: onStarted });
  };
  const running = start.error instanceof ApiError && start.error.code === "knowledge.feed_import_running";

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-primary-soft/60 p-3 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t("nothingLive")}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label={t("account")} htmlFor="feed-account">
          <Select id="feed-account" value={chosen} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.username ? `@${c.username}` : (c.displayName ?? c.externalId)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("posts")} htmlFor="feed-posts" hint={t("postsHint", { max: formatNumber(FEED_MAX_POSTS) })}>
          <Input id="feed-posts" type="number" dir="ltr" min={1} max={FEED_MAX_POSTS} value={posts} onChange={(e) => setPosts(e.target.value)} onBlur={() => setPosts(String(clampPosts(Number(posts))))} />
        </Field>
      </div>
      {start.isError ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(start.error)}{" "}
          {running && runningId ? (
            <Link href={`/w/${ws}/knowledge/import/${runningId}`} className="underline underline-offset-2">
              {t("openRunning")}
            </Link>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" loading={start.isPending} disabled={!chosen}>
        {t("start")}
      </Button>
    </form>
  );
}

/** Progress while the import reads posts, or why it failed. */
export function FeedProgress({ imp }: { imp: FeedImport }) {
  const t = useTranslations("knowledge.feed");
  const codeMessage = useCodeMessage();
  const running = imp.status === "running";
  return (
    <div className="space-y-3">
      <p role="status" className="flex items-center gap-2 text-sm font-medium">
        {running ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-primary" aria-hidden /> : null}
        {t(`statuses.${imp.status}` as "statuses.running")}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
        {(
          [
            ["postsRead", imp.postsRead],
            ["postsAnalyzed", imp.postsAnalyzed],
            ["postsFailed", imp.postsFailed],
            ["itemsFound", imp.itemsFound],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-muted p-2">
            <dd className="text-lg font-bold tabular-nums">{formatNumber(v)}</dd>
            <dt className="text-xs text-muted-foreground">{t(`progress.${k}`)}</dt>
          </div>
        ))}
      </dl>
      {running ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, (imp.postsRead / Math.max(1, imp.maxPosts)) * 100)}%` }} />
        </div>
      ) : null}
      {imp.status === "failed" ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {(imp.error && codeMessage(imp.error)) ?? t("failedGeneric")}
          {imp.error && !codeMessage(imp.error) ? (
            <bdi dir="ltr" className="ms-1 font-mono text-xs">
              ({imp.error})
            </bdi>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The import with its review (UP-2.5): progress while it runs, then suggestions grouped by post. Product and FAQ cards
 * are edited inline; accept, reject, or accept all selected. `canAccept` needs knowledge and catalog write.
 */
export function FeedImportReview({ ws, importId, canAccept, canEdit }: { ws: string; importId: string; canAccept: boolean; canEdit: boolean }) {
  const t = useTranslations("knowledge.feed");
  const errorMessage = useErrorMessage();
  const detail = useFeedImport(ws, importId);
  const acceptMany = useAcceptFeedItems(ws, importId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string[]>>({});

  if (detail.isPending) return <Skeleton className="h-64" />;
  if (detail.isError) return <p className="text-sm text-danger">{errorMessage(detail.error)}</p>;
  const { import: imp, items } = detail.data;
  const groups = groupByPost(items);
  const pending = items.filter(isPending);
  const chosen = pending.filter((i) => selected.has(i.id)).map((i) => i.id);
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const acceptSelected = () =>
    acceptMany.mutate(chosen.slice(0, FEED_ACCEPT_BATCH), {
      onSuccess: (r) => {
        setFailed(r.failed);
        setSelected(new Set(Object.keys(r.failed)));
        const nFailed = Object.keys(r.failed).length;
        if (r.accepted.length) toast.success(t("acceptedMany", { n: formatNumber(r.accepted.length) }));
        if (nFailed) toast.error(t("failedMany", { n: formatNumber(nFailed) }));
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <FeedProgress imp={imp} />
        </CardBody>
      </Card>

      {imp.status !== "running" && items.length === 0 ? <EmptyState icon={<Package />} title={t("noItems")} body={t("noItemsBody")} /> : null}

      {pending.length && canAccept ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-surface/95 p-3 backdrop-blur">
          <span className="text-sm">{t("pendingCount", { n: formatNumber(pending.length) })}</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(pending.map((i) => i.id)))}>
            {t("selectAll")}
          </Button>
          {chosen.length ? (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("selectNone")}
            </Button>
          ) : null}
          <Button size="sm" className="ms-auto" disabled={!chosen.length} loading={acceptMany.isPending} onClick={acceptSelected}>
            <Check aria-hidden />
            {t("acceptSelected")}
            {chosen.length ? ` (${formatNumber(Math.min(chosen.length, FEED_ACCEPT_BATCH))})` : ""}
          </Button>
        </div>
      ) : null}
      {!canAccept && pending.length ? <p className="text-sm text-muted-foreground">{t("cannotAccept")}</p> : null}

      {groups.map((g) => (
        <PostCard key={g.mediaId} group={g}>
          {g.items.map((item) => (
            <ItemCard
              key={item.id}
              ws={ws}
              importId={importId}
              item={item}
              canAccept={canAccept}
              canEdit={canEdit}
              selected={selected.has(item.id)}
              onSelect={(on) => toggle(item.id, on)}
              failures={failed[item.id] ?? []}
              onFailures={(codes) => setFailed((f) => ({ ...f, [item.id]: codes }))}
            />
          ))}
        </PostCard>
      ))}
    </div>
  );
}

function PostCard({ group: g, children }: { group: PostGroup; children: ReactNode }) {
  const t = useTranslations("knowledge.feed");
  const [broken, setBroken] = useState(false);
  return (
    <Card>
      <div className="flex items-center gap-3 border-b p-3 sm:p-4">
        {g.imageUrl && !broken ? (
          // Instagram's CDN, shown as is; not copied into the catalog.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.imageUrl} alt={t("postImage")} className="size-16 shrink-0 rounded-xl object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted-foreground">
            <ImageOff className="size-5" aria-hidden />
            <span className="sr-only">{t("noImage")}</span>
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{t("fromPost", { n: formatNumber(g.items.length) })}</p>
          {g.permalink ? (
            <a href={g.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              {t("openPost")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
      <ul className="divide-y">{children}</ul>
    </Card>
  );
}

function ItemCard({
  ws,
  importId,
  item,
  canAccept,
  canEdit,
  selected,
  onSelect,
  failures,
  onFailures,
}: {
  ws: string;
  importId: string;
  item: FeedItem;
  canAccept: boolean;
  canEdit: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  failures: string[];
  onFailures: (codes: string[]) => void;
}) {
  const t = useTranslations("knowledge.feed");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const update = useUpdateFeedItem(ws, importId);
  const accept = useAcceptFeedItem(ws, importId);
  const reject = useRejectFeedItem(ws, importId);
  const saved = draftOf(item);
  const [draft, setDraft] = useState<ItemDraft>(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  // A refetch (another tab, or the bulk accept) brings a newer copy; keep local edits otherwise.
  if (!sameDraft(saved, lastSaved)) {
    setLastSaved(saved);
    setDraft(saved);
  }
  const dirty = !sameDraft(draft, saved);
  const pending = isPending(item);
  const faq = item.kind === "faq";
  const id = `feed-${item.id}`;
  const editable = pending && canEdit;
  const busy = update.isPending || accept.isPending || reject.isPending;

  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.code === "knowledge.feed_item_invalid") {
      const codes = Object.values(err.fields).flat();
      onFailures(codes.length ? codes : [err.code]);
    } else toast.error(errorMessage(err));
  };
  const save = (then?: () => void) =>
    update.mutate({ itemId: item.id, body: updateOf(item.kind, draft) }, { onSuccess: () => then?.(), onError: fail });
  const doAccept = () => {
    onFailures([]);
    const go = () => accept.mutate(item.id, { onSuccess: (r) => toast.success(t(acceptOutcome(r) === "draft" ? "acceptedDraft" : "accepted")), onError: fail });
    if (dirty) save(go);
    else go();
  };
  // A price the owner sets here counts as confirmed, so the product goes on sale.
  const ownPrice = !faq && draft.price !== null && draft.price !== saved.price;
  const outcome = ownPrice ? "active" : acceptOutcome(item);

  return (
    <li className={cn("space-y-3 p-3 sm:p-4", !pending && "bg-surface-muted/40")}>
      <div className="flex flex-wrap items-center gap-2">
        {pending && canAccept ? (
          <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={t("select", { name: (faq ? item.question : item.title) ?? "" })} />
        ) : null}
        <Badge tone="primary">
          {faq ? <MessageCircleQuestion className="size-3" aria-hidden /> : <Package className="size-3" aria-hidden />}
          {t(faq ? "kindFaq" : "kindProduct")}
        </Badge>
        {!pending ? <Badge tone={item.status === "accepted" ? "success" : "neutral"}>{t(`itemStatuses.${item.status}` as "itemStatuses.accepted")}</Badge> : null}
        {item.status === "accepted" && item.createdId ? (
          <Link href={faq ? `/w/${ws}/knowledge?source=${item.createdId}` : `/w/${ws}/catalog/products/${item.createdId}`} className="text-xs text-primary hover:underline">
            {t(faq ? "openFaq" : "openProduct")}
          </Link>
        ) : null}
      </div>

      {!pending ? (
        <div className="space-y-0.5 text-sm">
          <p className="font-medium" dir="auto">
            {faq ? item.question : item.title || "—"}
          </p>
          <p className="text-muted-foreground" dir="auto">
            {faq ? item.answer : [item.price ? formatToman(rialOf(item.price) ?? 0) : null, item.description, item.tags.length ? item.tags.join("، ") : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : faq ? (
        <div className="space-y-2">
          <Field label={t("question")} htmlFor={`${id}-q`}>
            <Input id={`${id}-q`} dir="auto" maxLength={300} disabled={!editable} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          </Field>
          <Field label={t("answer")} htmlFor={`${id}-a`}>
            <Textarea id={`${id}-a`} dir="auto" rows={3} maxLength={2000} disabled={!editable} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
          </Field>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
            <Field label={t("title")} htmlFor={`${id}-title`}>
              <Input id={`${id}-title`} dir="auto" maxLength={200} disabled={!editable} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label={t("price")} htmlFor={`${id}-price`}>
              <MoneyInput id={`${id}-price`} disabled={!editable} value={draft.price} invalid={pending && !item.priceInCaption && draft.price === saved.price} onChange={(price) => setDraft({ ...draft, price })} />
            </Field>
          </div>
          {pending && !item.priceInCaption ? (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning-soft/60 p-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{t("priceNotInCaption")}</span> {t("priceDraftHint")}
              </span>
            </p>
          ) : null}
          <Field label={t("description")} htmlFor={`${id}-desc`}>
            <Textarea id={`${id}-desc`} dir="auto" rows={2} maxLength={2000} disabled={!editable} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label={t("tags")} htmlFor={`${id}-tags`}>
            <ChipsInput id={`${id}-tags`} values={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} max={20} maxLength={40} disabled={!editable} />
          </Field>
        </div>
      )}

      {failures.length ? (
        <ul role="alert" className="space-y-0.5 rounded-xl bg-danger-soft p-2.5 text-sm text-danger">
          {failures.map((c) => (
            <li key={c}>{codeMessage(c) ?? c}</li>
          ))}
        </ul>
      ) : null}

      {pending ? (
        <div className="flex flex-wrap items-center gap-2">
          {canAccept ? (
            <Button size="sm" onClick={doAccept} loading={accept.isPending} disabled={busy}>
              <Check aria-hidden />
              {dirty ? t("saveAndAccept") : t("accept")}
            </Button>
          ) : null}
          {editable && dirty ? (
            <Button size="sm" variant="outline" onClick={() => save(() => toast.success(t("saved")))} loading={update.isPending} disabled={busy}>
              {t("save")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => reject.mutate(item.id, { onError: fail })} loading={reject.isPending} disabled={busy}>
              <X aria-hidden />
              {t("reject")}
            </Button>
          ) : null}
          {!faq && canAccept ? <span className="text-xs text-muted-foreground">{t(outcome === "active" ? "willBeActive" : "willBeDraft")}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

/** One row of the import history. */
export function FeedImportRow({ ws, imp }: { ws: string; imp: FeedImport }) {
  const t = useTranslations("knowledge.feed");
  return (
    <li>
      <Link href={`/w/${ws}/knowledge/import/${imp.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted">
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={imp.status === "running" ? "primary" : imp.status === "failed" ? "danger" : "neutral"}>{t(`statuses.${imp.status}` as "statuses.running")}</Badge>
          <span>{t("rowSummary", { posts: formatNumber(imp.postsAnalyzed), items: formatNumber(imp.itemsFound) })}</span>
          <span className="text-xs text-muted-foreground">{formatRelative(imp.createdAt)}</span>
        </span>
        {imp.pending ? <Badge tone="warning">{t("pendingBadge", { n: formatNumber(imp.pending) })}</Badge> : null}
      </Link>
    </li>
  );
}

