import { NewOrderPage } from "@/features/orders/order-editor";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

const uuid = /^[0-9a-f-]{36}$/i;

export default async function Page({ searchParams }: { searchParams: Promise<{ conversation?: string; contact?: string }> }) {
  const { conversation, contact } = await searchParams;
  return (
    <RequirePermission permission={P.ordersWrite}>
      <NewOrderPage conversationId={conversation && uuid.test(conversation) ? conversation : null} contactId={contact && uuid.test(contact) ? contact : null} />
    </RequirePermission>
  );
}
