"use client";

import { Download, FileSpreadsheet, ImageOff, Package, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import type { Product } from "@/lib/api/types";
import { productStatuses } from "@/lib/api/types";
import { formatNumber, formatToman } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { categoryLabels, useCategories, useProducts } from "./data";
import { ImportDialog } from "./import-dialog";

const statusTone = { active: "success", draft: "neutral", archived: "warning" } as const;

/** «۸۹۰٬۰۰۰ تومان» or «از ۸۹۰٬۰۰۰ تا ۱٬۲۰۰٬۰۰۰ تومان» for products whose variants differ in price. */
export function priceLabel(p: Product, t: (key: "priceRange" | "noPrice", values?: Record<string, string>) => string): string {
  const min = rialOf(p.minPrice) ?? rialOf(p.price);
  const max = rialOf(p.maxPrice) ?? min;
  if (min === null) return t("noPrice");
  if (max !== null && max !== min) return t("priceRange", { min: formatNumber(Math.round(min / 10)), max: formatToman(max) });
  return formatToman(min);
}

export function ProductsPage() {
  const t = useTranslations("catalog");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.catalogWrite);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const query = useDeferredValue(q.trim());
  const products = useProducts(ws, { q: query, categoryId, status });
  const categories = useCategories(ws);
  const labels = categoryLabels(categories.data ?? []);
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(query || categoryId || status);
  const base = `/w/${ws}/catalog`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <a href={`/api/bff/workspaces/${ws}/catalog/export`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download aria-hidden />
            {t("export")}
          </a>
          {writable ? (
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
              <Upload aria-hidden />
              {t("import")}
            </Button>
          ) : null}
        </div>
        {writable ? (
          <Link href={`${base}/products/new`} className={buttonVariants()}>
            <Plus aria-hidden />
            {t("newProduct")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("search")} placeholder={t("searchPlaceholder")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label={t("category")} className="w-44" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t("allCategories")}</option>
          {[...labels].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <Select aria-label={t("status")} className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {productStatuses.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      <Card className="divide-y overflow-hidden">
        {products.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : products.isError ? (
          <EmptyState title={errorMessage(products.error)} action={<Button variant="outline" onClick={() => products.refetch()}>{t("retry")}</Button>} />
        ) : items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<Search />} title={t("noResults")} />
          ) : (
            <EmptyState
              icon={<Package />}
              title={t("empty")}
              body={t("emptyBody")}
              action={
                writable ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href={`${base}/products/new`} className={buttonVariants()}>
                      {t("newProduct")}
                    </Link>
                    <Button variant="outline" onClick={() => setImporting(true)}>
                      <FileSpreadsheet aria-hidden />
                      {t("importExcel")}
                    </Button>
                  </div>
                ) : null
              }
            />
          )
        ) : (
          items.map((p) => (
            <Link key={p.id} href={`${base}/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-muted/50 sm:p-4">
              <Thumb product={p} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium" dir="auto">
                  {p.title}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{priceLabel(p, t)}</span>
                  {p.categoryId && labels.get(p.categoryId) ? <span>· {labels.get(p.categoryId)}</span> : null}
                  {p.variants.length > 1 ? <span>· {t("variantCount", { n: formatNumber(p.variants.length) })}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={statusTone[p.status as keyof typeof statusTone] ?? "neutral"}>{t(`statuses.${p.status}` as "statuses.active")}</Badge>
                {!p.inStock ? <Badge tone="danger">{t("outOfStock")}</Badge> : null}
              </div>
            </Link>
          ))
        )}
      </Card>
      {products.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => products.fetchNextPage()} loading={products.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}

      {importing ? <ImportDialog onClose={() => setImporting(false)} /> : null}
    </div>
  );
}

function Thumb({ product }: { product: Product }) {
  const url = product.images.find((i) => i.url)?.url;
  return (
    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-muted text-muted-foreground">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs; next/image would re-host them.
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-5" aria-hidden />
      )}
    </span>
  );
}
