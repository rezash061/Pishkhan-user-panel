"use client";

import { ArrowRight, Printer } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { useInvoice } from "./data";

/**
 * Printable invoice (plan 3.8). The backend sends every value already in Persian (digits, Jalali dates, Toman), so the
 * page only lays it out; the shell hides itself when printing.
 */
export function InvoicePage({ orderId }: { orderId: string }) {
  const t = useTranslations("orders.invoice");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const invoice = useInvoice(workspace.id, orderId);
  const back = `/w/${workspace.id}/orders/${orderId}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <Button onClick={() => window.print()} disabled={!invoice.data}>
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </div>
      {invoice.isPending ? (
        <Skeleton className="h-96" />
      ) : invoice.isError ? (
        <EmptyState title={invoice.error instanceof ApiError && invoice.error.status === 404 ? t("notFound") : errorMessage(invoice.error)} />
      ) : (
        <article className="space-y-6 rounded-2xl border bg-surface p-5 text-sm sm:p-8 print:rounded-none print:border-0 print:p-0 print:text-black">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <h1 className="text-xl font-bold">{t("title")}</h1>
              <p className="mt-1 text-muted-foreground print:text-black">{workspace.name}</p>
            </div>
            <dl className="space-y-1 text-end">
              <div>
                <dt className="inline text-muted-foreground print:text-black">{t("number")}: </dt>
                <dd className="inline font-semibold">{invoice.data.numberText}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground print:text-black">{t("date")}: </dt>
                <dd className="inline">{invoice.data.dateLong}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground print:text-black">{t("status")}: </dt>
                <dd className="inline">{invoice.data.statusText}</dd>
              </div>
              {invoice.data.paidDate ? (
                <div>
                  <dt className="inline text-muted-foreground print:text-black">{t("paidDate")}: </dt>
                  <dd className="inline">{invoice.data.paidDate}</dd>
                </div>
              ) : null}
            </dl>
          </header>

          <section aria-labelledby="invoice-customer" className="space-y-1">
            <h2 id="invoice-customer" className="font-semibold">
              {t("customer")}
            </h2>
            <p dir="auto">{invoice.data.customerName || "—"}</p>
            {invoice.data.phone ? <p>{invoice.data.phone}</p> : null}
            {invoice.data.address ? <p dir="auto">{invoice.data.address}</p> : null}
            {invoice.data.postalCode ? <p>{t("postalCode", { code: invoice.data.postalCode })}</p> : null}
          </section>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse">
              <caption className="sr-only">{t("lines")}</caption>
              <thead>
                <tr className="border-b text-muted-foreground print:text-black">
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("item")}
                  </th>
                  <th scope="col" className="py-2 text-center font-medium">
                    {t("quantity")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("unitPrice")}
                  </th>
                  <th scope="col" className="py-2 text-end font-medium">
                    {t("lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.data.lines.map((line, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2" dir="auto">
                      {line.title}
                      {line.variantLabel ? <span className="block text-xs text-muted-foreground print:text-black">{line.variantLabel}</span> : null}
                    </td>
                    <td className="py-2 text-center">{line.quantity}</td>
                    <td className="py-2 text-end">{line.unitPrice}</td>
                    <td className="py-2 text-end">{line.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ms-auto max-w-xs space-y-1.5">
            <Row label={t("subtotal")} value={invoice.data.subtotal} />
            <Row label={t("shipping")} value={invoice.data.shippingFee} />
            <Row label={t("discount")} value={invoice.data.discount} />
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <dt>{t("total")}</dt>
              <dd>{invoice.data.total}</dd>
            </div>
          </dl>
          <p className="text-center text-xs text-muted-foreground print:text-black">{t("footer")}</p>
        </article>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground print:text-black">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
