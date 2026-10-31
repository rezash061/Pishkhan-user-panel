import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SupportBanner, SupportProvider } from "@/features/support/support";
import { getSupportSession } from "@/lib/auth/session";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("description"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    robots: { index: false, follow: false },
    icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16171d" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the request makes every page dynamic, so Next.js can stamp the per-request CSP nonce (src/proxy.ts) on its scripts.
  await headers();
  const [messages, support] = await Promise.all([getMessages(), getSupportSession()]);
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider messages={messages} locale="fa" timeZone="Asia/Tehran">
          <SupportProvider session={support}>
            <SupportBanner />
            <Providers>{children}</Providers>
          </SupportProvider>
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
