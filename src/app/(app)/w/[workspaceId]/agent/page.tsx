import { ComingSoon } from "@/features/shell/coming-soon";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.agentWrite}>
      <ComingSoon feature="agent" />
    </RequirePermission>
  );
}
