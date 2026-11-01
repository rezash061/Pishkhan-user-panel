import { notFound } from "next/navigation";
import { ContactPage } from "@/features/contacts/contact-page";

export default async function Page({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) notFound();
  return <ContactPage contactId={contactId} />;
}
