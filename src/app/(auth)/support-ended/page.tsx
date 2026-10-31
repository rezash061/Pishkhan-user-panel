import { Headset } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support");
  return { title: t("endedTitle") };
}

const reasons = ["ended", "expired", "invalid", "gone"] as const;

/** Where a support session lands when it ends, runs out, or its link was already used. */
export default async function Page({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const key = reasons.find((r) => r === reason) ?? "ended";
  const t = await getTranslations("support");
  return (
    <div className="space-y-4 rounded-2xl border bg-surface p-6 text-center">
      <Headset className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-bold">{t(`reasons.${key}.title`)}</h1>
      <p className="text-sm text-muted-foreground">{t(`reasons.${key}.body`)}</p>
      <Link href="/login" className={buttonVariants({ variant: "outline" })}>
        {t("toLogin")}
      </Link>
    </div>
  );
}
