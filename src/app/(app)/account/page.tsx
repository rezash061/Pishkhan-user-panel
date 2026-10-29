import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/page";
import { AccountPage } from "@/features/account/account-page";
import { loadMe } from "@/lib/api/server-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  const me = await loadMe();
  if (!me) redirect("/login?expired=1&next=/account");
  const t = await getTranslations();
  const back = ws && /^[0-9a-f-]{36}$/i.test(ws) ? `/w/${ws}` : "/workspaces";
  return (
    <PageContainer className="max-w-2xl">
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("common.back")}
      </Link>
      <h1 className="mb-5 text-xl font-bold sm:text-2xl">{t("account.title")}</h1>
      <AccountPage initialMe={me} />
    </PageContainer>
  );
}
