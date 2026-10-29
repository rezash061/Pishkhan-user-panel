import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("title") };
}

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission={P.catalogRead}>{children}</RequirePermission>;
}
