import { notFound } from "next/navigation";
import { TicketPage } from "@/features/tickets/ticket-page";

export default async function Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound();
  return <TicketPage ticketId={ticketId} />;
}
