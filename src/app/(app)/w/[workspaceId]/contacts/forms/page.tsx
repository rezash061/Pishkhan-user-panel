import { PageContainer } from "@/components/ui/page";
import { FormsPage } from "@/features/contacts/forms";
import { ContactsHeader } from "@/features/contacts/header";

export default function Page() {
  return (
    <PageContainer>
      <ContactsHeader />
      <FormsPage />
    </PageContainer>
  );
}
