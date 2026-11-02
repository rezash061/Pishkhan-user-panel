"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { PriceChangeLine, PriceChangePreview } from "@/lib/api/types";
import { productStatuses } from "@/lib/api/types";
import { formatNumber, formatToman } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { rialOf } from "@/lib/money";
import { categoryLabels, useCategories } from "./data";
import {
  newIdempotencyKey,
  previewRows,
  requestFromForm,
  roundingSteps,
  roundModes,
  useApplyPriceChange,
  usePreviewPriceChange,
  type PriceForm,
  type PriceFormError,
} from "./price-changes-data";

/**
 * «تغییر گروهی قیمت» (BE-2.6): pick which products (category, status, tag, or all), raise or lower by a percent or a Toman amount,
 * round, preview every price that changes, then apply as one batch that can be undone for 24 hours.
 */
export function PriceChangeDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { categoryId?: string; status?: string; tag?: string } }) {
  const t = useTranslations("catalog.prices");
  const tc = useTranslations("catalog");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const categories = useCategories(ws);
  const labels = categoryLabels(categories.data ?? []);
  const preview = usePreviewPriceChange(ws);
  const apply = useApplyPriceChange(ws);
  const [form, setForm] = useState<PriceForm>({
    categoryId: initial?.categoryId ?? "",
    status: initial?.status ?? "",
    tag: initial?.tag ?? "",
    kind: "percent",
    direction: "up",
    value: "",
    roundTo: 1_000,
    roundMode: "nearest",
  });
  const [error, setError] = useState<{ field: "value" | "scope" | "form"; message: string } | null>(null);
  const [result, setResult] = useState<PriceChangePreview | null>(null);
  const [stale, setStale] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);

  // Any change to the form drops the preview, so what is applied is always what was last shown.
  const set = <K extends keyof PriceForm>(k: K, v: PriceForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setResult(null);
    setStale(false);
    setError(null);
  };

  const formError = (e: PriceFormError) => ({ field: "value" as const, message: t(`errors.${e}`) });

  const fieldError = (err: unknown) => {
    if (!(err instanceof ApiError)) return null;
    for (const [field, target] of [["percent", "value"], ["amount", "value"], ["scope", "scope"], ["scope.categoryId", "scope"], ["scope.status", "scope"], ["roundTo", "form"], ["roundMode", "form"]] as const) {
      const code = err.field(field);
      if (code) return { field: target, message: codeMessage(code) ?? errorMessage(err) };
    }
    return null;
  };

  const runPreview = (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const built = requestFromForm(form);
    if ("error" in built) return setError(formError(built.error));
    preview.mutate(built.request, {
      onSuccess: (r) => {
        setResult(r);
        setKey(newIdempotencyKey());
      },
      onError: (err) => setError(fieldError(err) ?? { field: "form", message: errorMessage(err) }),
    });
  };

  const confirm = () => {
    const built = requestFromForm(form);
    if ("error" in built || !result) return;
    apply.mutate(
      { body: { ...built.request, fingerprint: result.fingerprint }, idempotencyKey: key },
      {
        onSuccess: (batch) => {
          toast.success(t("applied", { n: formatNumber(batch.priceCount) }), { description: t("appliedHint") });
          onClose();
        },
        onError: (err) => {
          setKey(newIdempotencyKey());
          if (err instanceof ApiError && err.code === "catalog.price_change_stale") {
            // The catalog changed since the preview: show the fresh numbers before anything is applied.
            setStale(true);
            preview.mutate(built.request, { onSuccess: setResult, onError: (e2) => setError({ field: "form", message: errorMessage(e2) }) });
            return;
          }
          setError({ field: "form", message: errorMessage(err) });
        },
      },
    );
  };

  const canApply = Boolean(result && result.items.length > 0 && result.invalid.length === 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      className="sm:max-w-2xl"
      title={t("title")}
      description={t("subtitle")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("editor.cancel")}
          </Button>
          {result ? (
            <Button onClick={confirm} loading={apply.isPending} disabled={!canApply || preview.isPending}>
              {t("apply", { n: formatNumber(result.priceCount) })}
            </Button>
          ) : (
            <Button type="submit" form="price-change-form" loading={preview.isPending}>
              {t("preview")}
            </Button>
          )}
        </>
      }
    >
      <form id="price-change-form" onSubmit={runPreview} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("which")}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select aria-label={tc("category")} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">{tc("allCategories")}</option>
              {[...labels].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select aria-label={tc("status")} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">{tc("allStatuses")}</option>
              {productStatuses.map((s) => (
                <option key={s} value={s}>
                  {tc(`statuses.${s}`)}
                </option>
              ))}
            </Select>
            <Input aria-label={t("tag")} placeholder={t("tagPlaceholder")} value={form.tag} maxLength={40} onChange={(e) => set("tag", e.target.value)} />
          </div>
          <p className={error?.field === "scope" ? "text-xs text-danger" : "text-xs text-muted-foreground"}>{error?.field === "scope" ? error.message : form.categoryId ? t("subcategoriesIncluded") : t("scopeHint")}</p>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Segmented
            label={t("direction")}
            value={form.direction}
            onChange={(v) => set("direction", v)}
            options={[
              { value: "up", label: t("up") },
              { value: "down", label: t("down") },
            ]}
          />
          <Segmented
            label={t("kind")}
            value={form.kind}
            onChange={(v) => set("kind", v)}
            options={[
              { value: "percent", label: t("percent") },
              { value: "amount", label: t("amount") },
            ]}
          />
        </div>

        <Field label={form.kind === "percent" ? t("percentLabel") : t("amountLabel")} htmlFor="price-change-value" error={error?.field === "value" ? error.message : undefined} hint={form.kind === "percent" ? t("percentHint") : t("amountHint")}>
          <div className="flex items-center gap-2">
            <Input
              id="price-change-value"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="max-w-40 text-end"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              aria-invalid={error?.field === "value" || undefined}
            />
            <span className="text-sm text-muted-foreground">{form.kind === "percent" ? "٪" : tc("toman")}</span>
          </div>
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t("roundTo")} htmlFor="price-change-round">
            <Select id="price-change-round" value={String(form.roundTo)} onChange={(e) => set("roundTo", Number(e.target.value))}>
              {roundingSteps.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? t("noRounding") : t("roundStep", { n: formatNumber(s) })}
                </option>
              ))}
            </Select>
          </Field>
          {form.roundTo > 1 ? (
            <Field label={t("roundMode")} htmlFor="price-change-mode">
              <Select id="price-change-mode" value={form.roundMode} onChange={(e) => set("roundMode", e.target.value as PriceForm["roundMode"])}>
                {roundModes.map((m) => (
                  <option key={m} value={m}>
                    {t(`modes.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        {result ? null : (
          <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
        )}
      </form>

      {error?.field === "form" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message}
        </p>
      ) : null}

      {result ? <PreviewResult result={result} stale={stale} /> : null}
    </Dialog>
  );
}

function PreviewResult({ result, stale }: { result: PriceChangePreview; stale: boolean }) {
  const t = useTranslations("catalog.prices");
  const rows = result.items.slice(0, previewRows);
  const ref = useRef<HTMLElement>(null);
  // On phones the form fills the sheet: bring the fresh numbers into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [result]);
  return (
    <section ref={ref} aria-labelledby="price-preview-title" className="mt-5 space-y-3 border-t pt-4">
      <h3 id="price-preview-title" className="text-sm font-semibold">
        {t("previewTitle")}
      </h3>
      {stale ? (
        <p role="status" className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
          {t("stale")}
        </p>
      ) : null}
      {result.items.length === 0 && result.invalid.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      ) : (
        <p className="text-sm">{t("summary", { prices: formatNumber(result.priceCount), products: formatNumber(result.productCount) })}</p>
      )}
      {result.invalid.length ? (
        <div role="alert" className="space-y-1 rounded-xl border border-danger/40 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            {t("invalid", { n: formatNumber(result.invalid.length) })}
          </p>
          <ul className="list-inside list-disc text-muted-foreground">
            {result.invalid.slice(0, 10).map((l) => (
              <li key={`${l.productId}:${l.variantId ?? ""}`} dir="auto">
                {lineTitle(l)} ({formatToman(rialOf(l.oldPrice) ?? 0)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rows.length ? <PriceLines lines={rows} more={result.items.length - rows.length} /> : null}
    </section>
  );
}

/** Product and variant, old and new price, as a table. Shared with the history details. */
export function PriceLines({ lines, more = 0 }: { lines: PriceChangeLine[]; more?: number }) {
  const t = useTranslations("catalog.prices");
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[26rem] text-sm">
        <caption className="sr-only">{t("previewTitle")}</caption>
        <thead className="bg-surface-muted text-muted-foreground">
          <tr>
            <th scope="col" className="p-2 text-start font-medium">
              {t("product")}
            </th>
            <th scope="col" className="p-2 text-end font-medium">
              {t("oldPrice")}
            </th>
            <th scope="col" className="w-6 p-2">
              <span className="sr-only">{t("to")}</span>
            </th>
            <th scope="col" className="p-2 text-end font-medium">
              {t("newPrice")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((l) => (
            <tr key={`${l.productId}:${l.variantId ?? ""}`}>
              <td className="p-2" dir="auto">
                {lineTitle(l)}
              </td>
              <td className="p-2 text-end text-muted-foreground">{formatToman(rialOf(l.oldPrice) ?? 0)}</td>
              <td className="p-2 text-muted-foreground">
                <ArrowLeft className="size-3.5" aria-hidden />
              </td>
              <td className="p-2 text-end font-medium">{l.newPrice ? formatToman(rialOf(l.newPrice) ?? 0) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 ? <p className="border-t p-2 text-center text-xs text-muted-foreground">{t("more", { n: formatNumber(more) })}</p> : null}
    </div>
  );
}

const lineTitle = (l: PriceChangeLine) => (l.variantLabel ? `${l.title} – ${l.variantLabel}` : l.title);
