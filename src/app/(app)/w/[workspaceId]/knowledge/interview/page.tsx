import { InterviewPage } from "@/features/knowledge/interview-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { fact } = await searchParams;
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <InterviewPage fact={fact ?? null} />
    </RequirePermission>
  );
}
