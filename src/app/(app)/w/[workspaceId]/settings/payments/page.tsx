import { MerchantSettings } from "@/features/payments/merchant-settings";
import { BankAccounts, ReceiptSettingsCard } from "@/features/receipts/settings";

export default function Page() {
  return (
    <div className="space-y-5">
      <MerchantSettings />
      <BankAccounts />
      <ReceiptSettingsCard />
    </div>
  );
}
