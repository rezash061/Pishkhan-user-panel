import { notFound } from "next/navigation";
import { EditOrderPage } from "@/features/orders/order-editor";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  return (
    <RequirePermission permission={P.ordersWrite}>
      <EditOrderPage orderId={orderId} />
    </RequirePermission>
  );
}
