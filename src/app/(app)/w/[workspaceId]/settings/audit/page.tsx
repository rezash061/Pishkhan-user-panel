import { AuditLog } from "@/features/audit/audit-log";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.auditRead}>
      <AuditLog />
    </RequirePermission>
  );
}
