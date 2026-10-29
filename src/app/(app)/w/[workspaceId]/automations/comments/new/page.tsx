import { CommentWizard } from "@/features/automations/comment-wizard";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.automationWrite}>
      <CommentWizard />
    </RequirePermission>
  );
}
