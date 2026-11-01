import { PageContainer } from "@/components/ui/page";
import { ContactsHeader } from "@/features/contacts/header";
import { SegmentsPage } from "@/features/contacts/segments-page";

export default function Page() {
  return (
    <PageContainer>
      <ContactsHeader />
      <SegmentsPage />
    </PageContainer>
  );
}
