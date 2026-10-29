"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, ImageOff, LayoutGrid, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/api/keys";
import type { CardSet, StorefrontCard } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber, formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useCardSetPreview, useCardSets, useDeleteCardSet, useProducts, useSaveCardSet } from "./data";
import { priceLabel } from "./products-page";

/** Instagram shows at most 10 cards in a carousel (backend `StorefrontCardSet.MaxCards`). */
const MAX_CARDS = 10;

export function StorefrontCardsPage() {
  const t = useTranslations("catalog.cards");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.catalogWrite);
  const sets = useCardSets(ws);
  const remove = useDeleteCardSet(ws);
  const [editing, setEditing] = useState<CardSet | "new" | null>(null);
  const [previewing, setPreviewing] = useState<CardSet | null>(null);
  const [deleting, setDeleting] = useState<CardSet | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{t("subtitle")}</p>
        {writable ? (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        ) : null}
      </div>
      <Card className="divide-y overflow-hidden">
        {sets.isPending ? (
          <div className="p-4">
            <Skeleton className="h-12" />
          </div>
        ) : sets.isError ? (
          <EmptyState title={errorMessage(sets.error)} />
        ) : sets.data.length === 0 ? (
          <EmptyState icon={<LayoutGrid />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          sets.data.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-3 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("count", { n: formatNumber(s.items.length) })} · {formatRelative(s.updatedAt)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`${t("preview")} ${s.name}`} onClick={() => setPreviewing(s)}>
                <Eye />
              </Button>
              {writable ? (
                <>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t("edit")} ${s.name}`} onClick={() => setEditing(s)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`${t("delete")} ${s.name}`} onClick={() => setDeleting(s)}>
                    <Trash2 />
                  </Button>
                </>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {editing ? <CardSetDialog key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {previewing ? <PreviewDialog set={previewing} onClose={() => setPreviewing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        title={t("deleteConfirm")}
        body={deleting ? `${deleting.name} — ${t("deleteHint")}` : null}
        confirmLabel={t("delete")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}

interface Item {
  productId: string;
  buttonTitle: string;
}

function CardSetDialog({ initial, onClose }: { initial: CardSet | null; onClose: () => void }) {
  const t = useTranslations("catalog.cards");
  const tc = useTranslations("catalog");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const save = useSaveCardSet(ws);
  const [name, setName] = useState(initial?.name ?? "");
  const [items, setItems] = useState<Item[]>(() => initial?.items.map((i) => ({ productId: i.productId, buttonTitle: i.buttonTitle ?? "" })) ?? []);
  const [q, setQ] = useState("");
  const search = useProducts(ws, { q: useDeferredValue(q.trim()), status: "active" });
  const results = search.data?.pages.flatMap((p) => p.items) ?? [];
  // Titles of chosen products (an existing set stores only product ids).
  const chosen = useQueries({
    queries: items.map((i) => ({
      queryKey: qk.product(ws, i.productId),
      queryFn: async () => unwrap(await api.GET("/api/v1/workspaces/{workspaceId}/catalog/products/{productId}", { params: { path: { workspaceId: ws, productId: i.productId } } })),
      staleTime: 60_000,
    })),
  });
  const err = save.error instanceof ApiError ? save.error : null;
  const general = save.error ? (codeMessage(err?.field("items")) ?? codeMessage(err?.field("name")) ?? errorMessage(save.error)) : null;

  const move = (i: number, by: number) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    setItems(next);
  };

  const submit = () =>
    save.mutate(
      { id: initial?.id, name: name.trim(), items: items.map((i) => ({ productId: i.productId, buttonTitle: i.buttonTitle.trim() || null })) },
      { onSuccess: () => (toast.success(t("saved")), onClose()) },
    );

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      className="max-w-2xl"
      title={initial ? t("edit") : t("new")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={!name.trim() || items.length === 0}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {general ? (
          <p role="alert" className="text-sm text-danger">
            {general}
          </p>
        ) : null}
        <Field label={t("name")} htmlFor="cards-name" hint={t("nameHint")}>
          <Input id="cards-name" dir="auto" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t("chosen")} ({toPersianDigits(items.length)}/{toPersianDigits(MAX_CARDS)})
          </p>
          {items.length === 0 ? <p className="text-sm text-muted-foreground">{t("chooseHint")}</p> : null}
          {items.map((item, i) => {
            const product = chosen[i]?.data;
            return (
              <div key={item.productId} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                <span className="w-6 text-center text-xs text-muted-foreground">{toPersianDigits(i + 1)}</span>
                <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                  {product?.title ?? "…"}
                </span>
                <Input
                  aria-label={t("buttonTitle")}
                  placeholder={t("buttonPlaceholder")}
                  maxLength={20}
                  className="h-9 w-32"
                  value={item.buttonTitle}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, buttonTitle: e.target.value } : x)))}
                />
                <Button variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            );
          })}
        </div>

        {items.length < MAX_CARDS ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" aria-label={t("searchProducts")} placeholder={t("searchProducts")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">
              {search.isPending ? (
                <div className="p-3">
                  <Spinner />
                </div>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{t("noProducts")}</p>
              ) : (
                results
                  .filter((p) => !items.some((i) => i.productId === p.id))
                  .map((p) => (
                    <button key={p.id} type="button" className="flex w-full items-center gap-3 p-2.5 text-start hover:bg-surface-muted" onClick={() => setItems([...items, { productId: p.id, buttonTitle: "" }])}>
                      <Plus className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm" dir="auto">
                        {p.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{priceLabel(p, tc)}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

function PreviewDialog({ set, onClose }: { set: CardSet; onClose: () => void }) {
  const t = useTranslations("catalog.cards");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const preview = useCardSetPreview(workspace.id, set.id);
  return (
    <Dialog open onClose={onClose} variant="sheet" className="max-w-2xl" title={set.name} description={t("previewHint")}>
      {preview.isPending ? (
        <Skeleton className="h-64" />
      ) : preview.isError ? (
        <p className="text-sm text-danger">{errorMessage(preview.error)}</p>
      ) : preview.data.cards.length === 0 ? (
        <EmptyState title={t("previewEmpty")} />
      ) : (
        <div className="rounded-3xl bg-surface-muted/60 p-3">
          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
            {preview.data.cards.map((c) => (
              <PreviewCard key={c.productId} card={c} />
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** One carousel card as Instagram draws it: image, title, subtitle (price) and a button. */
export function PreviewCard({ card }: { card: StorefrontCard }) {
  return (
    <div className="w-48 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface text-sm shadow-sm">
      <div className="grid aspect-square place-items-center bg-border/40 text-muted-foreground">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs.
          <img src={card.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-6" aria-hidden />
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="line-clamp-2 font-medium" dir="auto">
          {card.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">
          {card.subtitle}
        </p>
      </div>
      <p className="border-t py-2 text-center font-medium text-primary">{card.buttonTitle}</p>
    </div>
  );
}
