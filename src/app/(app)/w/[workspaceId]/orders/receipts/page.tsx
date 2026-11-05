import { Suspense } from "react";
import { ReceiptsPage } from "@/features/receipts/receipts-page";

export default function Page() {
  return (
    <Suspense>
      <ReceiptsPage />
    </Suspense>
  );
}
