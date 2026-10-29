import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Logo className="size-12" />
        <p className="text-lg font-bold">{t("name")}</p>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
