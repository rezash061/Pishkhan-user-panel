import { OutagePage } from "@/features/outage/outage-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.crmRead}>
      <OutagePage />
    </RequirePermission>
  );
}
