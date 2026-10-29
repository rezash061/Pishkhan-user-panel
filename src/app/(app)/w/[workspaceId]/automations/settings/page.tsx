import { PageContainer } from "@/components/ui/page";
import { AutomationsHeader } from "@/features/automations/header";
import { AutomationSettingsPage } from "@/features/automations/settings-page";

export default function Page() {
  return (
    <PageContainer>
      <AutomationsHeader />
      <AutomationSettingsPage />
    </PageContainer>
  );
}
