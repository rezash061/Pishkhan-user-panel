import { ScorePage } from "@/features/knowledge/score-page";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.settingsRead}>
      <ScorePage />
    </RequirePermission>
  );
}
