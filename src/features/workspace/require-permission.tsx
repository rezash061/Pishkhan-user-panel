"use client";

import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { Permission } from "@/lib/permissions";
import { useWorkspace } from "./context";

/** Direct URLs to sections the role cannot see get a Persian 403 page instead of a broken screen (plan 2.3). */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const t = useTranslations("pages");
  const { workspace, can } = useWorkspace();
  if (can(permission)) return children;
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <EmptyState
        icon={<ShieldOff />}
        title={t("forbidden")}
        body={t("forbiddenBody")}
        action={
          <Link href={`/w/${workspace.id}`} className={buttonVariants({ variant: "outline" })}>
            {t("home")}
          </Link>
        }
      />
    </div>
  );
}
