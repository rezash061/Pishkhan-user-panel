"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChipsInput } from "@/components/ui/chips-input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { PageContainer, StickyActions } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Product, ProductRequest, ProductStatus } from "@/lib/api/types";
import { productStatuses } from "@/lib/api/types";
import { uploadFile, waitUntilScanned } from "@/lib/api/upload";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { moneyFromToman, tomanOf } from "@/lib/money";
import { P } from "@/lib/permissions";
import { categoryLabels, useCategories, useDeleteProduct, useProduct, useSaveProduct } from "./data";
import { MAX_OPTIONS, MAX_VARIANTS, optionsFromVariants, rowFromVariant, syncRows, variantLabel, variantRequest, type ProductOption, type VariantRow } from "./variants";

const MAX_IMAGES = 10;

interface Image {
  fileId: string | null;
  url: string | null;
  /** Local preview while the file uploads and is scanned. */
  preview?: string;
  uploading?: boolean;
  key: string;
}

interface Form {
  title: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  status: ProductStatus;
  price: number | null;
  images: Image[];
  linkUrl: string;
  hasVariants: boolean;
  options: ProductOption[];
  rows: VariantRow[];
  /** The one stock line of a product without options (sent as a single variant without attributes). */
  simple: VariantRow;
}

const simpleRow = (): VariantRow => ({ id: null, attributes: {}, sku: "", price: null, stockPolicy: "unlimited", stock: null });

function formFrom(p?: Product): Form {
  if (!p) return { title: "", description: "", categoryId: null, tags: [], status: "active", price: null, images: [], linkUrl: "", hasVariants: false, options: [], rows: [], simple: simpleRow() };
  const withAttributes = p.variants.filter((v) => Object.keys(v.attributes).length);
  const single = p.variants.length === 1 && !withAttributes.length ? rowFromVariant(p.variants[0]!) : simpleRow();
  return {
    title: p.title,
    description: p.description ?? "",
    categoryId: p.categoryId,
    tags: p.tags,
    status: (p.status as ProductStatus) ?? "active",
    price: tomanOf(p.price),
    images: p.images.map((i) => ({ fileId: i.fileId, url: i.url, key: i.fileId })),
    linkUrl: p.linkUrl ?? "",
    hasVariants: withAttributes.length > 0,
    options: optionsFromVariants(withAttributes),
    rows: withAttributes.map(rowFromVariant),
    simple: single,
  };
}

function requestFrom(f: Form): ProductRequest {
  const variants = f.hasVariants ? f.rows.map(variantRequest) : f.simple.stockPolicy === "track" || f.simple.sku.trim() ? [variantRequest({ ...f.simple, attributes: {}, price: null })] : [];
  return {
    title: f.title.trim(),
    description: f.description.trim() || null,
    categoryId: f.categoryId,
    tags: f.tags,
    status: f.status,
    price: moneyFromToman(f.price),
    imageFileIds: f.images.filter((i) => i.fileId).map((i) => i.fileId!),
    linkUrl: f.linkUrl.trim() || null,
    variants,
  };
}

/** Client copies of `CatalogValidator` rules, keyed like the server's field errors. */
function problems(f: Form): Record<string, string> {
  const p: Record<string, string> = {};
  if (!f.title.trim()) p.title = "validation.required";
  if (f.linkUrl.trim() && !/^https?:\/\/\S+$/i.test(f.linkUrl.trim())) p.linkUrl = "catalog.link_invalid";
  const rowsPriced = f.hasVariants && f.rows.length > 0 && f.rows.every((r) => r.price !== null);
  if (f.status === "active" && f.price === null && !rowsPriced) p.price = "catalog.price_required";
  if (f.hasVariants && f.rows.length === 0) p.variants = "catalog.variant_needs_attributes";
  if (f.images.some((i) => i.uploading)) p.imageFileIds = "catalog.images_uploading";
  return p;
}

export function EditProduct({ productId }: { productId: string }) {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const product = useProduct(workspace.id, productId);
  if (product.isPending)
    return (
      <PageContainer className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72" />
      </PageContainer>
    );
  if (product.isError) return <EmptyState title={errorMessage(product.error)} />;
  return <ProductEditor key={`${product.data.id}-${product.data.revision}`} product={product.data} />;
}

export function ProductEditor({ product }: { product?: Product }) {
  const t = useTranslations("catalog");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.catalogWrite);
  const categories = useCategories(ws);
  const save = useSaveProduct(ws);
  const remove = useDeleteProduct(ws);
  const [form, setForm] = useState<Form>(() => formFrom(product));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/w/${ws}/catalog`;
  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const found = problems(form);
  const serverError = save.error instanceof ApiError ? save.error : null;
  const fieldError = (path: string) => (submitted ? codeMessage(found[path]) : null) ?? codeMessage(serverError?.field(path));
  const generalError = save.error && !(serverError && Object.keys(serverError.fields).length) ? errorMessage(save.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(found).length) {
      toast.error(t("editor.fixErrors"));
      return;
    }
    save.mutate(
      { id: product?.id, body: requestFrom(form) },
      {
        onSuccess: (saved) => {
          toast.success(t("editor.saved"));
          if (!product) router.replace(`${base}/products/${saved.id}`);
        },
      },
    );
  };

  const setOptions = (options: ProductOption[]) => patch({ options, rows: syncRows(options, form.rows, { stockPolicy: form.simple.stockPolicy }) });

  return (
    <PageContainer>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={base} className="text-sm text-muted-foreground hover:text-foreground">
              {t("title")}
            </Link>
            <h1 className="truncate text-xl font-bold sm:text-2xl" dir="auto">
              {product ? product.title : t("editor.newTitle")}
            </h1>
          </div>
          {product && writable ? (
            <Button variant="outline" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              {t("editor.delete")}
            </Button>
          ) : null}
        </div>
        {!writable ? <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("readOnly")}</p> : null}
        {generalError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {generalError}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardBody className="space-y-4">
                <Field label={t("editor.name")} htmlFor="p-title" error={fieldError("title")}>
                  <Input id="p-title" dir="auto" maxLength={200} disabled={!writable} value={form.title} placeholder={t("editor.namePlaceholder")} onChange={(e) => patch({ title: e.target.value })} aria-invalid={Boolean(fieldError("title")) || undefined} />
                </Field>
                <Field label={`${t("editor.description")} (${t("optional")})`} htmlFor="p-description" hint={t("editor.descriptionHint")} error={fieldError("description")}>
                  <Textarea id="p-description" dir="auto" rows={4} maxLength={4000} disabled={!writable} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t("editor.images")} description={t("editor.imagesHint")} />
              <CardBody>
                {fieldError("imageFileIds") ? (
                  <p role="alert" className="mb-2 text-sm text-danger">
                    {fieldError("imageFileIds")}
                  </p>
                ) : null}
                <ImagesField ws={ws} images={form.images} onChange={(images) => setForm((f) => ({ ...f, images: typeof images === "function" ? images(f.images) : images }))} disabled={!writable} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t("editor.pricing")} />
              <CardBody className="space-y-4">
                <Field label={t("editor.price")} htmlFor="p-price" hint={form.hasVariants ? t("editor.priceVariantsHint") : t("editor.priceHint")} error={fieldError("price")}>
                  <MoneyInput id="p-price" value={form.price} onChange={(price) => patch({ price })} disabled={!writable} invalid={Boolean(fieldError("price"))} />
                </Field>

                <div className="flex items-center gap-3">
                  <Switch id="p-has-variants" label={t("editor.hasVariants")} checked={form.hasVariants} disabled={!writable} onChange={(hasVariants) => patch({ hasVariants, ...(hasVariants && !form.options.length ? { options: [{ name: t("editor.defaultOption"), values: [] }] } : {}) })} />
                  <label htmlFor="p-has-variants" className="text-sm">
                    <span className="block font-medium">{t("editor.hasVariants")}</span>
                    <span className="block text-xs text-muted-foreground">{t("editor.hasVariantsHint")}</span>
                  </label>
                </div>

                {form.hasVariants ? (
                  <VariantsMatrix options={form.options} rows={form.rows} onOptions={setOptions} onRows={(rows) => patch({ rows })} disabled={!writable} fieldError={fieldError} />
                ) : (
                  <StockFields row={form.simple} onChange={(simple) => patch({ simple })} disabled={!writable} />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardBody className="space-y-4">
                <Field label={t("status")} htmlFor="p-status" hint={t(`statusHints.${form.status}`)} error={fieldError("status")}>
                  <Select id="p-status" disabled={!writable} value={form.status} onChange={(e) => patch({ status: e.target.value as ProductStatus })}>
                    {productStatuses.map((s) => (
                      <option key={s} value={s}>
                        {t(`statuses.${s}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("category")}
                  htmlFor="p-category"
                  error={fieldError("categoryId")}
                  hint={
                    <Link href={`${base}/categories`} className="text-primary hover:underline">
                      {t("manageCategories")}
                    </Link>
                  }
                >
                  <Select id="p-category" disabled={!writable} value={form.categoryId ?? ""} onChange={(e) => patch({ categoryId: e.target.value || null })}>
                    <option value="">{t("noCategory")}</option>
                    {[...categoryLabels(categories.data ?? [])].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("editor.tags")} htmlFor="p-tags" hint={t("editor.tagsHint")} error={fieldError("tags")}>
                  <ChipsInput id="p-tags" values={form.tags} onChange={(tags) => patch({ tags })} max={20} maxLength={40} disabled={!writable} />
                </Field>
                <Field label={`${t("editor.link")} (${t("optional")})`} htmlFor="p-link" hint={t("editor.linkHint")} error={fieldError("linkUrl")}>
                  <Input id="p-link" type="url" dir="ltr" maxLength={500} disabled={!writable} value={form.linkUrl} placeholder="https://" onChange={(e) => patch({ linkUrl: e.target.value })} />
                </Field>
              </CardBody>
            </Card>
          </div>
        </div>

        {writable ? (
          <StickyActions>
            <Link href={base} className={buttonVariants({ variant: "outline" })}>
              {t("editor.cancel")}
            </Link>
            <Button type="submit" loading={save.isPending}>
              {product ? t("editor.save") : t("editor.create")}
            </Button>
          </StickyActions>
        ) : null}
      </form>

      {product ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          danger
          title={t("editor.deleteConfirm")}
          body={product.title}
          confirmLabel={t("editor.delete")}
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(product.id, {
              onSuccess: () => {
                toast.success(t("editor.deleted"));
                router.replace(base);
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      ) : null}
    </PageContainer>
  );
}

function StockFields({ row, onChange, disabled, compact }: { row: VariantRow; onChange: (row: VariantRow) => void; disabled?: boolean; compact?: boolean }) {
  const t = useTranslations("catalog.editor");
  return (
    <div className={cn("flex flex-wrap items-end gap-3", compact && "gap-2")}>
      <div className="space-y-1.5">
        {compact ? null : <span className="block text-sm font-medium">{t("stock")}</span>}
        <Segmented
          label={t("stock")}
          value={row.stockPolicy}
          disabled={disabled}
          onChange={(stockPolicy) => onChange({ ...row, stockPolicy, stock: stockPolicy === "track" ? (row.stock ?? 0) : null })}
          options={[
            { value: "unlimited", label: t("unlimited") },
            { value: "track", label: t("track") },
          ]}
        />
      </div>
      {row.stockPolicy === "track" ? (
        <Input
          type="number"
          inputMode="numeric"
          dir="ltr"
          min={0}
          max={1_000_000}
          aria-label={t("stockCount")}
          placeholder={t("stockCount")}
          className="h-10 w-28"
          disabled={disabled}
          value={row.stock ?? 0}
          onChange={(e) => onChange({ ...row, stock: Math.max(0, Math.min(1_000_000, Math.floor(Number(e.target.value) || 0))) })}
        />
      ) : null}
      {compact ? null : (
        <Input aria-label={t("sku")} placeholder={t("skuPlaceholder")} dir="ltr" maxLength={64} className="h-10 w-40" disabled={disabled} value={row.sku} onChange={(e) => onChange({ ...row, sku: e.target.value })} />
      )}
    </div>
  );
}

function VariantsMatrix({
  options,
  rows,
  onOptions,
  onRows,
  disabled,
  fieldError,
}: {
  options: ProductOption[];
  rows: VariantRow[];
  onOptions: (options: ProductOption[]) => void;
  onRows: (rows: VariantRow[]) => void;
  disabled?: boolean;
  fieldError: (path: string) => string | null;
}) {
  const t = useTranslations("catalog.editor");
  const setRow = (i: number, row: VariantRow) => onRows(rows.map((r, j) => (j === i ? row : r)));
  const error = fieldError("variants") ?? fieldError("variants.attributes") ?? fieldError("variants.sku") ?? fieldError("variants.price") ?? fieldError("variants.stock");
  const combos = options.reduce((n, o) => n * Math.max(1, o.values.length), 1);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-[10rem_1fr_auto]">
            <Input
              aria-label={t("optionName")}
              placeholder={t("optionNamePlaceholder")}
              dir="auto"
              maxLength={40}
              className="h-10"
              disabled={disabled}
              value={o.name}
              onChange={(e) => onOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <ChipsInput id={`option-${i}`} values={o.values} onChange={(values) => onOptions(options.map((x, j) => (j === i ? { ...x, values } : x)))} placeholder={t("optionValuesPlaceholder")} maxLength={100} disabled={disabled} />
            <Button variant="ghost" size="icon" aria-label={t("removeOption")} disabled={disabled} onClick={() => onOptions(options.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        ))}
        {options.length < MAX_OPTIONS ? (
          <Button variant="link" size="sm" className="h-auto px-0" disabled={disabled} onClick={() => onOptions([...options, { name: "", values: [] }])}>
            <Plus aria-hidden />
            {t("addOption")}
          </Button>
        ) : null}
        {combos > MAX_VARIANTS ? <p className="text-xs text-danger">{t("tooManyVariants", { max: formatNumber(MAX_VARIANTS) })}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-surface-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("variant")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("variantPrice")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("stock")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("sku")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={variantLabel(r.attributes)}>
                  <td className="px-3 py-2 font-medium" dir="auto">
                    {variantLabel(r.attributes)}
                  </td>
                  <td className="px-3 py-2">
                    <MoneyInput aria-label={`${variantLabel(r.attributes)} ${t("variantPrice")}`} className="h-10 w-40" placeholder={t("samePrice")} value={r.price} onChange={(price) => setRow(i, { ...r, price })} disabled={disabled} />
                  </td>
                  <td className="px-3 py-2">
                    <StockFields compact row={r} onChange={(row) => setRow(i, row)} disabled={disabled} />
                  </td>
                  <td className="px-3 py-2">
                    <Input aria-label={`${variantLabel(r.attributes)} ${t("sku")}`} dir="ltr" maxLength={64} className="h-10 w-32" disabled={disabled} value={r.sku} onChange={(e) => setRow(i, { ...r, sku: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("variantsEmpty")}</p>
      )}
    </div>
  );
}

function ImagesField({ ws, images, onChange, disabled }: { ws: string; images: Image[]; onChange: (images: Image[] | ((current: Image[]) => Image[])) => void; disabled?: boolean }) {
  const t = useTranslations("catalog.editor");
  const errorMessage = useErrorMessage();

  const add = (files: FileList) => {
    const room = MAX_IMAGES - images.length;
    for (const file of [...files].slice(0, room)) {
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      onChange((list) => [...list, { key, fileId: null, url: null, preview, uploading: true }]);
      void (async () => {
        try {
          const uploaded = await uploadFile(ws, "product_image", file);
          const clean = await waitUntilScanned(ws, uploaded.id);
          onChange((list) => list.map((i) => (i.key === key ? { ...i, fileId: clean.id, url: clean.thumbnailUrl ?? clean.url, uploading: false } : i)));
        } catch (e) {
          toast.error(`${file.name}: ${errorMessage(e)}`);
          onChange((list) => list.filter((i) => i.key !== key));
        }
      })();
    }
  };

  const move = (i: number, by: number) =>
    onChange((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(i + by, 0, item!);
      return next;
    });

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {images.map((img, i) => (
        <div key={img.key} className="group relative aspect-square overflow-hidden rounded-xl border bg-surface-muted">
          {img.url || img.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob previews and signed storage URLs.
            <img src={img.url ?? img.preview} alt="" className={cn("size-full object-cover", img.uploading && "opacity-50")} />
          ) : null}
          {img.uploading ? (
            <span className="absolute inset-0 grid place-items-center" role="status" aria-label={t("uploading")}>
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            </span>
          ) : null}
          {i === 0 ? <span className="absolute start-1 top-1 rounded-md bg-surface/90 px-1.5 text-[10px] font-medium">{t("cover")}</span> : null}
          {!disabled && !img.uploading ? (
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-0.5">
                <IconChip label={t("moveEarlier")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowRight />
                </IconChip>
                <IconChip label={t("moveLater")} disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                  <ArrowLeft />
                </IconChip>
              </div>
              <IconChip label={t("removeImage")} onClick={() => onChange((list) => list.filter((x) => x.key !== img.key))}>
                <Trash2 />
              </IconChip>
            </div>
          ) : null}
        </div>
      ))}
      {!disabled && images.length < MAX_IMAGES ? (
        <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary">
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImagePlus className="size-6" aria-hidden />
            {t("addImage")}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function IconChip({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-7 place-items-center rounded-lg bg-surface/90 shadow-sm disabled:opacity-40 [&_svg]:size-3.5">
      {children}
    </button>
  );
}
