import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { KnowledgePage } from "@/features/knowledge/knowledge-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("knowledge");
  return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { source } = await searchParams;
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <KnowledgePage openSource={source && /^[0-9a-f-]{36}$/i.test(source) ? source : null} />
    </RequirePermission>
  );
}
