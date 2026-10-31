import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadWorkspaces } from "@/lib/api/server-data";
import { formatDate } from "@/lib/i18n/format";
import { LogoutButton } from "@/features/auth/logout-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspaces");
  return { title: t("title") };
}

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const workspaces = await loadWorkspaces();
  if (workspaces === null) redirect("/login?expired=1");
  if (workspaces.length === 0) redirect("/onboarding/workspace");
  if (workspaces.length === 1 && !all) redirect(`/w/${workspaces[0]!.id}`);

  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Logo />
        <LogoutButton />
      </div>
      <h1 className="text-xl font-bold">{t("workspaces.title")}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t("workspaces.subtitle")}</p>
      <Card className="divide-y overflow-hidden">
        {workspaces.map((w) => (
          <Link key={w.id} href={`/w/${w.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-muted">
            <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Building2 className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{w.name}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`industries.${w.industry}` as "industries.other")} · {t("workspaces.role", { role: t(`roles.${w.role}` as "roles.owner") })}
              </span>
              {w.status === "pending_deletion" ? (
                <span className="mt-1 block text-xs font-medium text-danger">
                  {w.deletionScheduledFor ? t("deletion.listBadge", { date: formatDate(w.deletionScheduledFor) }) : t("deletion.listBadgeNoDate")}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </Card>
      <Link href="/onboarding/workspace" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
        <Plus aria-hidden />
        {t("workspaces.create")}
      </Link>
    </main>
  );
}
