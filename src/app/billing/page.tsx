import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkoutCookie, checkoutReturnPath } from "@/features/billing/checkout";
import { cookieNames } from "@/lib/auth/cookies";

/**
 * Zarinpal subscription payments return here (backend `Billing:Checkout:ReturnUrl`, `?checkout={id}&status=paid|failed|pending`).
 * The redirect has no workspace, so the billing page stored it in the `pk-checkout` cookie before leaving for the gateway.
 */
export default async function CheckoutReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const jar = await cookies();
  const ws = jar.get(checkoutCookie)?.value || jar.get(cookieNames.lastWorkspace)?.value;
  redirect(checkoutReturnPath(ws, params.checkout, params.status));
}
