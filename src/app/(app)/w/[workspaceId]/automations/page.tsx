import { PageContainer } from "@/components/ui/page";
import { AutomationsHeader } from "@/features/automations/header";
import { RulesPage } from "@/features/automations/rules-page";

export default function Page() {
  return (
    <PageContainer>
      <AutomationsHeader />
      <RulesPage />
    </PageContainer>
  );
}
