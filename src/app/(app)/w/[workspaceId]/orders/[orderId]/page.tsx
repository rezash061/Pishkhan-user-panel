import { notFound } from "next/navigation";
import { OrderPage } from "@/features/orders/order-page";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  return <OrderPage orderId={orderId} />;
}
