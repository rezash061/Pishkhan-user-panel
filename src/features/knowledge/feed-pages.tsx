"use client";

import { ArrowRight, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useFeedImports } from "./feed-data";
import { FeedImportReview, FeedImportRow, FeedImportStart } from "./feed-import";
import { KnowledgeTabs } from "./tabs";

/** «ورود از پست‌ها»: start an import and the last 20, each with what is still waiting for review (BE-2.5). */
export function FeedImportsPage() {
  const t = useTranslations("knowledge");
  const tf = useTranslations("knowledge.feed");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const imports = useFeedImports(workspace.id);
  const running = imports.data?.find((i) => i.status === "running") ?? null;

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <KnowledgeTabs />
      <Card>
        <CardHeader title={tf("startTitle")} description={tf("startSubtitle")} />
        <CardBody>
          <FeedImportStart ws={workspace.id} runningId={running?.id} onStarted={(imp) => router.push(`/w/${workspace.id}/knowledge/import/${imp.id}`)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={tf("historyTitle")} />
        <div className="mt-3 border-t">
          {imports.isPending ? (
            <Skeleton className="m-4 h-14" />
          ) : imports.isError ? (
            <p className="p-4 text-sm text-danger">{errorMessage(imports.error)}</p>
          ) : imports.data.length === 0 ? (
            <EmptyState icon={<History />} title={tf("historyEmpty")} />
          ) : (
            <ul className="divide-y">
              {imports.data.map((imp) => (
                <FeedImportRow key={imp.id} ws={workspace.id} imp={imp} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

export function FeedImportPage({ importId }: { importId: string }) {
  const t = useTranslations("knowledge.feed");
  const { workspace, can } = useWorkspace();
  return (
    <PageContainer className="max-w-3xl space-y-4">
      <Link href={`/w/${workspace.id}/knowledge/import`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowRight aria-hidden />
        {t("back")}
      </Link>
      <PageHeader title={t("reviewTitle")} description={t("reviewSubtitle")} />
      <FeedImportReview ws={workspace.id} importId={importId} canEdit={can(P.knowledgeWrite)} canAccept={can(P.knowledgeWrite) && can(P.catalogWrite)} />
    </PageContainer>
  );
}
