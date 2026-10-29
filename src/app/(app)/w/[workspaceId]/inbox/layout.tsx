import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";
import type { ReactNode } from "react";
import { InboxFrame } from "@/features/inbox/inbox-frame";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission={P.inboxRead}><InboxFrame>{children}</InboxFrame></RequirePermission>;
}
