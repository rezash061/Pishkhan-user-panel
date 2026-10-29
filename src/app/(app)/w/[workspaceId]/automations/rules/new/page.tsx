import { RuleEditor } from "@/features/automations/rule-editor";
import { RequirePermission } from "@/features/workspace/require-permission";
import { triggerKinds, type TriggerKind } from "@/lib/api/types";
import { P } from "@/lib/permissions";

export default async function Page({ searchParams }: { searchParams: Promise<{ trigger?: string }> }) {
  const { trigger } = await searchParams;
  const initial = triggerKinds.includes(trigger as TriggerKind) ? (trigger as TriggerKind) : undefined;
  return (
    <RequirePermission permission={P.automationWrite}>
      <RuleEditor initialTrigger={initial} />
    </RequirePermission>
  );
}
