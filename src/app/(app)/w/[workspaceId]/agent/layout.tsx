import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui/page";
import { AgentHeader } from "@/features/agent/header";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agent");
  return { title: t("title") };
}

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <RequirePermission permission={P.agentWrite}>
      <PageContainer>
        <AgentHeader />
        {children}
      </PageContainer>
    </RequirePermission>
  );
}
