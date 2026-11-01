import { PageContainer } from "@/components/ui/page";
import { ContactsHeader } from "@/features/contacts/header";
import { TagsPage } from "@/features/contacts/tags-page";

export default function Page() {
  return (
    <PageContainer>
      <ContactsHeader />
      <TagsPage />
    </PageContainer>
  );
}
