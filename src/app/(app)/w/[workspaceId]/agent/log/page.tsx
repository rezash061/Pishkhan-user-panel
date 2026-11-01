import { Suspense } from "react";
import { AgentLogPage } from "@/features/agent/log-page";

export default function Page() {
  return (
    <Suspense>
      <AgentLogPage />
    </Suspense>
  );
}
