import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tickets");
  return { title: t("title") };
}

export default function SupportLayout({ children }: { children: ReactNode }) {
  return children;
}
