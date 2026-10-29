import { PageContainer } from "@/components/ui/page";
import { AutomationsHeader } from "@/features/automations/header";
import { FlowsPage } from "@/features/flows/flows-page";

export default function Page() {
  return (
    <PageContainer>
      <AutomationsHeader />
      <FlowsPage />
    </PageContainer>
  );
}
