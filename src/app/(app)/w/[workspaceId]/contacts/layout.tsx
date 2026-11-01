import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contacts");
  return { title: t("title") };
}

export default function ContactsLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission={P.crmRead}>{children}</RequirePermission>;
}
