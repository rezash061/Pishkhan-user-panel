"use client";

import { ArrowRight, Package, PenLine, Plus, Search, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { MoneyInput } from "@/components/ui/money-input";
import { PageContainer, StickyActions } from "@/components/ui/page";
import { useProduct, useProducts } from "@/features/catalog/data";
import { variantLabel } from "@/features/catalog/variants";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Order, OrderRequest, Product, Variant } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toLatinDigits, toPersianDigits } from "@/lib/i18n/digits";
import { formatToman } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { moneyFromToman, rialOf, tomanOf } from "@/lib/money";
import { normalizeIranMobile } from "@/lib/phone";
import { newIdempotencyKey, orderLimits, useCreateOrder, useOrder, useParseAddress, useProvinces, useUpdateOrder } from "./data";
import { nationalMobile } from "./order-page";

/** One editor row: a catalog product (priced by the backend) or a custom line with its own title and price. */
export type Line =
  | { key: number; kind: "product"; productId: string; variantId: string | null; title: string; variantText: string | null; quantity: number; estimate: number | null }
  | { key: number; kind: "custom"; title: string; unitPrice: number | null; quantity: number };

export interface Draft {
  lines: Line[];
  shipping: number | null;
  discount: number | null;
  customerName: string;
  phone: string;
  recipient: string;
  province: string;
  city: string;
  line: string;
  postalCode: string;
  note: string;
}

const emptyDraft: Draft = { lines: [], shipping: null, discount: null, customerName: "", phone: "", recipient: "", province: "", city: "", line: "", postalCode: "", note: "" };

export function draftFromOrder(o: Order): Draft {
  let key = 1;
  return {
    lines: o.items.map((it) =>
      it.productId
        ? { key: key++, kind: "product", productId: it.productId, variantId: it.variantId, title: it.title, variantText: it.variantLabel, quantity: it.quantity, estimate: tomanOf(it.unitPrice) }
        : { key: key++, kind: "custom", title: it.title, unitPrice: tomanOf(it.unitPrice), quantity: it.quantity },
    ),
    shipping: tomanOf(o.shippingFee),
    discount: tomanOf(o.discount) || null,
    customerName: o.customerName ?? "",
    phone: o.phone ? (nationalMobile(o.phone) ?? "") : "",
    recipient: o.address?.recipient ?? "",
    province: o.address?.provinceCode ?? o.address?.province ?? "",
    city: o.address?.city ?? "",
    line: o.address?.line ?? "",
    postalCode: o.address?.postalCode ?? "",
    note: o.note ?? "",
  };
}

/** The request body; an address is sent only when something of it was filled in. */
export function requestFromDraft(d: Draft, link: { conversationId: string | null; contactId: string | null }): OrderRequest {
  const opt = (s: string) => s.trim() || null;
  const hasAddress = [d.recipient, d.province, d.city, d.line, d.postalCode].some((x) => x.trim());
  return {
    conversationId: link.conversationId,
    contactId: link.conversationId ? null : link.contactId,
    items: d.lines.map((l) =>
      l.kind === "product"
        ? { productId: l.productId, variantId: l.variantId, quantity: l.quantity, title: null, unitPrice: null }
        : { productId: null, variantId: null, quantity: l.quantity, title: l.title.trim(), unitPrice: moneyFromToman(l.unitPrice) },
    ),
    shippingFee: moneyFromToman(d.shipping ?? 0),
    discount: moneyFromToman(d.discount ?? 0),
    customerName: opt(d.customerName),
    phone: opt(toLatinDigits(d.phone).replace(/\s/g, "")),
    address: hasAddress ? { recipient: opt(d.recipient), province: opt(d.province), city: opt(d.city), line: opt(d.line), postalCode: opt(toLatinDigits(d.postalCode)) } : null,
    note: opt(d.note),
  };
}

/** A rough total before saving; the backend prices catalog lines itself. */
export function estimateToman(d: Draft): number {
  const lines = d.lines.reduce((sum, l) => sum + (l.kind === "product" ? (l.estimate ?? 0) : (l.unitPrice ?? 0)) * l.quantity, 0);
  return Math.max(0, lines + (d.shipping ?? 0) - (d.discount ?? 0));
}

const productEstimate = (p: Product, v: Variant | null) => tomanOf(v?.effectivePrice ?? v?.price ?? p.price ?? p.minPrice);

export function NewOrderPage({ conversationId, contactId }: { conversationId: string | null; contactId: string | null }) {
  return <OrderEditor initial={emptyDraft} link={{ conversationId, contactId }} order={null} />;
}

export function EditOrderPage({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const order = useOrder(workspace.id, orderId);
  if (order.isPending)
    return (
      <PageContainer>
        <Skeleton className="h-96" />
      </PageContainer>
    );
  if (order.isError)
    return (
      <PageContainer>
        <EmptyState title={order.error instanceof ApiError && order.error.status === 404 ? t("notFound") : errorMessage(order.error)} />
      </PageContainer>
    );
  if (order.data.status !== "draft")
    return (
      <PageContainer>
        <EmptyState title={t("editor.notEditable")} action={<Link href={`/w/${workspace.id}/orders/${orderId}`} className="text-primary hover:underline">{t("editor.backToOrder")}</Link>} />
      </PageContainer>
    );
  return <OrderEditor key={order.data.revision} initial={draftFromOrder(order.data)} link={{ conversationId: order.data.conversationId, contactId: order.data.contactId }} order={order.data} />;
}

function OrderEditor({ initial, link, order }: { initial: Draft; link: { conversationId: string | null; contactId: string | null }; order: Order | null }) {
  const t = useTranslations("orders.editor");
  const to = useTranslations("orders");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const [idempotencyKey] = useState(newIdempotencyKey);
  const create = useCreateOrder(ws, idempotencyKey);
  const update = useUpdateOrder(ws, order?.id ?? "");
  const save = order ? update : create;
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const nextKey = useRef(initial.lines.length + 1);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));
  const setLine = (key: number, patch: Partial<Line>) => setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? ({ ...l, ...patch } as Line) : l)) }));
  const back = order ? `/w/${ws}/orders/${order.id}` : link.conversationId ? `/w/${ws}/inbox/${link.conversationId}` : `/w/${ws}/orders`;

  const addProduct = (p: Product) => {
    const variant = p.variants.find((v) => v.inStock) ?? p.variants[0] ?? null;
    const many = p.variants.length > 1;
    setD((x) => ({
      ...x,
      lines: [
        ...x.lines,
        { key: nextKey.current++, kind: "product", productId: p.id, variantId: many ? (variant?.id ?? null) : null, title: p.title, variantText: many && variant ? variantLabel(variant.attributes) : null, quantity: 1, estimate: productEstimate(p, many ? variant : null) },
      ],
    }));
    setPicking(false);
  };
  const addCustom = () => setD((x) => ({ ...x, lines: [...x.lines, { key: nextKey.current++, kind: "custom", title: "", unitPrice: null, quantity: 1 }] }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const local: Record<string, string> = {};
    if (d.phone.trim() && !normalizeIranMobile(d.phone)) local.phone = t("invalid.phone");
    d.lines.forEach((l, i) => {
      if (l.kind === "custom" && (!l.title.trim() || !l.unitPrice)) local[`items[${i}]`] = t("invalid.custom");
    });
    if (Object.keys(local).length) return setErrors(local);
    save.mutate(requestFromDraft(d, link), {
      onSuccess: (saved) => {
        toast.success(order ? t("saved") : t("created", { number: toPersianDigits(saved.number) }));
        router.push(`/w/${ws}/orders/${saved.id}`);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 400 && Object.keys(err.fields).length) {
          const next: Record<string, string> = {};
          for (const [field, codes] of Object.entries(err.fields)) next[field] = codeMessage(codes[0]) ?? errorMessage(err);
          setErrors(next);
          toast.error(t("fixErrors"));
          return;
        }
        toast.error(errorMessage(err));
      },
    });
  };

  const estimate = estimateToman(d);
  const generalErrors = Object.entries(errors).filter(([k]) => !/^items\[\d+\]$/.test(k) && !["shippingFee", "discount", "customerName", "phone", "note", "items", "address", "address.line", "address.province", "address.postalCode", "address.city", "text"].includes(k));

  return (
    <PageContainer className="space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {tc("back")}
      </Link>
      <PageHeader title={order ? t("editTitle", { number: toPersianDigits(order.number) }) : t("newTitle")} description={t("hint")} />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Card>
          <CardHeader title={t("items")} description={t("itemsHint")} />
          <CardBody className="space-y-3">
            {d.lines.length === 0 ? <p className="text-sm text-muted-foreground">{t("noLines")}</p> : null}
            <ul className="space-y-3">
              {d.lines.map((l, i) => (
                <LineRow key={l.key} line={l} index={i} error={errors[`items[${i}]`]} onChange={(patch) => setLine(l.key, patch)} onRemove={() => setD((x) => ({ ...x, lines: x.lines.filter((y) => y.key !== l.key) }))} />
              ))}
            </ul>
            {errors.items ? (
              <p role="alert" className="text-sm text-danger">
                {errors.items}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPicking(true)} disabled={d.lines.length >= orderLimits.items}>
                <Package aria-hidden />
                {t("addProduct")}
              </Button>
              <Button variant="outline" onClick={addCustom} disabled={d.lines.length >= orderLimits.items}>
                <PenLine aria-hidden />
                {t("addCustom")}
              </Button>
            </div>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
              <Field label={t("shipping")} htmlFor="order-shipping" error={errors.shippingFee}>
                <MoneyInput id="order-shipping" value={d.shipping} onChange={(v) => set("shipping", v)} placeholder="0" invalid={Boolean(errors.shippingFee)} />
              </Field>
              <Field label={t("discount")} htmlFor="order-discount" error={errors.discount}>
                <MoneyInput id="order-discount" value={d.discount} onChange={(v) => set("discount", v)} placeholder="0" invalid={Boolean(errors.discount)} />
              </Field>
            </div>
            <p className="flex justify-between text-sm font-semibold">
              <span>{t("estimate")}</span>
              <span>{formatToman(estimate * 10)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("estimateHint")}</p>
          </CardBody>
        </Card>

        <CustomerFields d={d} set={set} setD={setD} errors={errors} />

        <Card>
          <CardBody>
            <Field label={to("note")} htmlFor="order-note-field" error={errors.note} hint={t("noteHint")}>
              <Textarea id="order-note-field" dir="auto" maxLength={orderLimits.note} value={d.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </CardBody>
        </Card>

        {generalErrors.length ? (
          <ul role="alert" className="space-y-1 text-sm text-danger">
            {generalErrors.map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        ) : null}

        <StickyActions>
          <Link href={back} className="inline-flex h-10 items-center px-4 text-sm hover:underline">
            {tc("cancel")}
          </Link>
          <Button type="submit" loading={save.isPending}>
            {order ? t("save") : t("create")}
          </Button>
        </StickyActions>
      </form>
      {picking ? <ProductPicker onPick={addProduct} onClose={() => setPicking(false)} /> : null}
    </PageContainer>
  );
}

function LineRow({ line: l, index, error, onChange, onRemove }: { line: Line; index: number; error?: string; onChange: (patch: Partial<Line>) => void; onRemove: () => void }) {
  const t = useTranslations("orders.editor");
  const n = toPersianDigits(index + 1);
  const name = l.kind === "product" ? l.title : l.title || t("customLine", { n });
  return (
    <li className={cn("space-y-2 rounded-xl border p-3", error && "border-danger")}>
      <div className="flex flex-wrap items-end gap-2">
        {l.kind === "product" ? (
          <div className="min-w-0 flex-1 basis-48 space-y-1.5">
            <p className="text-sm font-medium" dir="auto">
              {l.title}
            </p>
            <VariantSelect line={l} onChange={onChange} />
          </div>
        ) : (
          <>
            <Field label={t("lineTitle")} htmlFor={`line-${l.key}-title`} className="min-w-0 flex-1 basis-48">
              <Input id={`line-${l.key}-title`} dir="auto" maxLength={orderLimits.title} value={l.title} onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label={t("unitPrice")} htmlFor={`line-${l.key}-price`} className="w-40">
              <MoneyInput id={`line-${l.key}-price`} value={l.unitPrice} onChange={(v) => onChange({ unitPrice: v })} />
            </Field>
          </>
        )}
        <Field label={t("quantity")} htmlFor={`line-${l.key}-qty`} className="w-24">
          <Input
            id={`line-${l.key}-qty`}
            inputMode="numeric"
            dir="ltr"
            className="text-center"
            value={toPersianDigits(l.quantity)}
            onChange={(e) => {
              const q = Number(toLatinDigits(e.target.value).replace(/\D/g, "") || "0");
              onChange({ quantity: Math.min(orderLimits.quantity, Math.max(1, q)) });
            }}
          />
        </Field>
        <Button variant="ghost" size="icon" aria-label={t("removeLine", { name })} onClick={onRemove}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      {l.kind === "product" && l.estimate !== null ? <p className="text-xs text-muted-foreground">{t("lineEstimate", { price: formatToman(l.estimate * 10) })}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Variants are chosen per line; editing an existing order loads the product to list them. */
function VariantSelect({ line: l, onChange }: { line: Extract<Line, { kind: "product" }>; onChange: (patch: Partial<Line>) => void }) {
  const t = useTranslations("orders.editor");
  const { workspace } = useWorkspace();
  const product = useProduct(workspace.id, l.productId);
  const variants = product.data?.variants ?? [];
  if (variants.length <= 1) return l.variantText ? <p className="text-xs text-muted-foreground">{l.variantText}</p> : null;
  return (
    <Select
      aria-label={t("variantFor", { title: l.title })}
      value={l.variantId ?? ""}
      onChange={(e) => {
        const v = variants.find((x) => x.id === e.target.value) ?? null;
        onChange({ variantId: v?.id ?? null, variantText: v ? variantLabel(v.attributes) : null, estimate: product.data ? productEstimate(product.data, v) : null });
      }}
    >
      <option value="">{t("chooseVariant")}</option>
      {variants.map((v) => (
        <option key={v.id} value={v.id} disabled={!v.inStock}>
          {variantLabel(v.attributes)}
          {v.inStock ? "" : ` (${t("outOfStock")})`}
        </option>
      ))}
    </Select>
  );
}

function ProductPicker({ onPick, onClose }: { onPick: (p: Product) => void; onClose: () => void }) {
  const t = useTranslations("orders.editor");
  const { workspace } = useWorkspace();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const products = useProducts(workspace.id, { q: query, status: "active" });
  const items = products.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Dialog open onClose={onClose} variant="sheet" title={t("pickTitle")}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("pickSearch")} placeholder={t("pickSearch")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {products.isPending ? (
          <Skeleton className="h-32" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("pickEmpty")}</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y overflow-y-auto rounded-xl border">
            {items.map((p) => {
              const price = rialOf(p.price ?? p.minPrice);
              return (
                <li key={p.id}>
                  <button type="button" disabled={!p.inStock} onClick={() => onPick(p)} className="flex w-full items-center gap-3 p-3 text-start text-sm hover:bg-surface-muted disabled:opacity-60">
                    <span className="min-w-0 flex-1 truncate font-medium" dir="auto">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{!p.inStock ? t("outOfStock") : price !== null ? formatToman(price) : t("noPrice")}</span>
                    <Plus className="size-4 shrink-0 text-primary" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {products.hasNextPage ? (
          <Button variant="outline" size="sm" onClick={() => products.fetchNextPage()} loading={products.isFetchingNextPage}>
            {t("pickMore")}
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}

function CustomerFields({
  d,
  set,
  setD,
  errors,
}: {
  d: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  setD: (fn: (x: Draft) => Draft) => void;
  errors: Record<string, string>;
}) {
  const t = useTranslations("orders.editor");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const provinces = useProvinces(workspace.id);
  const parse = useParseAddress(workspace.id);
  const [pasted, setPasted] = useState("");
  const province = useMemo(() => provinces.data?.find((p) => p.code === d.province || p.name === d.province) ?? null, [provinces.data, d.province]);

  const fill = () => {
    if (!pasted.trim()) return;
    parse.mutate(pasted.trim(), {
      onSuccess: (a) => {
        setD((x) => ({
          ...x,
          province: a.provinceCode ?? x.province,
          city: a.city ?? x.city,
          line: a.line || x.line,
          postalCode: a.postalCode ?? x.postalCode,
          phone: x.phone.trim() || !a.mobile ? x.phone : (nationalMobile(a.mobile) ?? a.mobile),
        }));
        toast.success(t("parsed"));
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Card>
      <CardHeader title={t("customer")} />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("customerName")} htmlFor="order-name" error={errors.customerName}>
            <Input id="order-name" dir="auto" autoComplete="off" maxLength={orderLimits.name} value={d.customerName} onChange={(e) => set("customerName", e.target.value)} />
          </Field>
          <Field label={t("phone")} htmlFor="order-phone" error={errors.phone} hint={t("phoneHint")}>
            <Input id="order-phone" dir="ltr" inputMode="tel" autoComplete="off" placeholder="۰۹۱۲ ۱۲۳ ۴۵۶۷" value={d.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2 rounded-xl bg-surface-muted/60 p-3">
          <Field label={t("paste")} htmlFor="order-paste" hint={t("pasteHint")} error={errors.text}>
            <Textarea id="order-paste" dir="auto" className="min-h-20" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </Field>
          <Button size="sm" variant="secondary" onClick={fill} loading={parse.isPending} disabled={!pasted.trim()}>
            <Wand2 aria-hidden />
            {t("parse")}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("province")} htmlFor="order-province" error={errors["address.province"]}>
            <Select id="order-province" value={province?.code ?? d.province} onChange={(e) => setD((x) => ({ ...x, province: e.target.value, city: "" }))}>
              <option value="">{t("chooseProvince")}</option>
              {(provinces.data ?? []).map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("city")} htmlFor="order-city" error={errors["address.city"]}>
            <Input id="order-city" dir="auto" list="order-cities" autoComplete="off" value={d.city} onChange={(e) => set("city", e.target.value)} />
            <datalist id="order-cities">
              {(province?.cities ?? []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label={t("line")} htmlFor="order-line" error={errors["address.line"] ?? errors.address}>
          <Textarea id="order-line" dir="auto" maxLength={orderLimits.line} className="min-h-20" value={d.line} onChange={(e) => set("line", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("postalCode")} htmlFor="order-postal" error={errors["address.postalCode"]} hint={t("postalHint")}>
            <Input id="order-postal" dir="ltr" inputMode="numeric" maxLength={11} value={d.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
          <Field label={t("recipient")} htmlFor="order-recipient" hint={t("recipientHint")}>
            <Input id="order-recipient" dir="auto" maxLength={orderLimits.name} value={d.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </Field>
        </div>
      </CardBody>
    </Card>
  );
}
