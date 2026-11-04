import { FeedImportsPage } from "@/features/knowledge/feed-pages";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.knowledgeWrite}>
      <FeedImportsPage />
    </RequirePermission>
  );
}
