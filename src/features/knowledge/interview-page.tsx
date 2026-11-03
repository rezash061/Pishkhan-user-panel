"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useWorkspace } from "@/features/workspace/context";
import { Interview } from "./interview";

/** The interview inside the panel, reached from the knowledge score page. */
export function InterviewPage({ fact }: { fact: string | null }) {
  const t = useTranslations("knowledge.interview");
  const { workspace } = useWorkspace();
  const router = useRouter();
  const back = `/w/${workspace.id}/knowledge/score`;
  return (
    <PageContainer className="max-w-2xl space-y-4">
      <Link href={back} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowRight aria-hidden />
        {t("backToScore")}
      </Link>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Interview ws={workspace.id} startAt={fact} onFinished={() => router.push(back)} finishLabel={t("backToScore")} />
    </PageContainer>
  );
}
