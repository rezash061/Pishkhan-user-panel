import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { KnowledgePage } from "@/features/knowledge/knowledge-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("knowledge");
  return { title: t("title") };
}

export default function Page() {
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <KnowledgePage />
    </RequirePermission>
  );
}
