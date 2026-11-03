import { Suspense } from "react";
import { PageContainer } from "@/components/ui/page";
import { FollowUpsPage } from "@/features/automations/followups-page";
import { AutomationsHeader } from "@/features/automations/header";

export default function Page() {
  return (
    <PageContainer>
      <AutomationsHeader />
      <Suspense>
        <FollowUpsPage />
      </Suspense>
    </PageContainer>
  );
}
