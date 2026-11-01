import { Suspense } from "react";
import { PageContainer } from "@/components/ui/page";
import { ContactsHeader } from "@/features/contacts/header";
import { ContactsPage } from "@/features/contacts/contacts-page";

export default function Page() {
  return (
    <PageContainer>
      <ContactsHeader />
      <Suspense>
        <ContactsPage />
      </Suspense>
    </PageContainer>
  );
}
