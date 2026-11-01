import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/page";
import { FormSubmissionsPage } from "@/features/contacts/forms";
import { ContactsHeader } from "@/features/contacts/header";

export default async function Page({ params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(flowId)) notFound();
  return (
    <PageContainer>
      <ContactsHeader />
      <FormSubmissionsPage flowId={flowId} />
    </PageContainer>
  );
}
