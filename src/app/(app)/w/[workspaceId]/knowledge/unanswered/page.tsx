import { UnansweredPage } from "@/features/knowledge/unanswered-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <UnansweredPage />
    </RequirePermission>
  );
}
