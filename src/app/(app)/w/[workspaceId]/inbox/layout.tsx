import type { ReactNode } from "react";
import { InboxFrame } from "@/features/inbox/inbox-frame";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <InboxFrame>{children}</InboxFrame>;
}
