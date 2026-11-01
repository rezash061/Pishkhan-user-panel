import { PageContainer } from "@/components/ui/page";
import { ContactsHeader } from "@/features/contacts/header";
import { FieldsPage } from "@/features/contacts/fields-page";

export default function Page() {
  return (
    <PageContainer>
      <ContactsHeader />
      <FieldsPage />
    </PageContainer>
  );
}
