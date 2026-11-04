import { notFound } from "next/navigation";
import { FeedImportPage } from "@/features/knowledge/feed-pages";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default async function Page({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(importId)) notFound();
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <FeedImportPage importId={importId} />
    </RequirePermission>
  );
}
