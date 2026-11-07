import { Suspense } from "react";
import { TicketsPage } from "@/features/tickets/tickets-page";

export default function Page() {
  return (
    <Suspense>
      <TicketsPage />
    </Suspense>
  );
}
