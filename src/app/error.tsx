"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <EmptyState icon={<TriangleAlert />} title={t("pages.error")} body={t("pages.errorBody")} action={<Button onClick={reset}>{t("common.retry")}</Button>} />
    </main>
  );
}
