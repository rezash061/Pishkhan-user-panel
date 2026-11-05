"use client";

import { FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/features/workspace/context";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useSubmitReceipt } from "./data";

/**
 * «ثبت به‌عنوان رسید» under a customer's image (UP-2.3): sends it to the receipt checks for the contact's order awaiting
 * payment. Images sent while an order awaits payment are usually taken automatically; this covers the rest.
 */
export function MarkReceipt({ messageId }: { messageId: string }) {
  const t = useTranslations("receipts");
  const errorMessage = useErrorMessage();
  const { workspace, can } = useWorkspace();
  const submit = useSubmitReceipt(workspace.id);
  const router = useRouter();
  if (!can(P.ordersWrite)) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      loading={submit.isPending}
      onClick={() =>
        submit.mutate(
          { messageId },
          {
            onSuccess: (receipt) =>
              toast.success(t("submitted"), {
                action: { label: t("open"), onClick: () => router.push(`/w/${workspace.id}/orders/receipts?status=all&receipt=${receipt.id}`) },
              }),
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <FileCheck2 aria-hidden />
      {t("markFromMessage")}
    </Button>
  );
}
