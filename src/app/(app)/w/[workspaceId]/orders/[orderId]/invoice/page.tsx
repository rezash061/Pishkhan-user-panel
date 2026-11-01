import { notFound } from "next/navigation";
import { InvoicePage } from "@/features/orders/invoice-page";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  return <InvoicePage orderId={orderId} />;
}
