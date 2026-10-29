import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/features/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  // Only same-site paths, so the login page cannot be used as an open redirect.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return <LoginForm next={safeNext} expired={expired === "1"} />;
}
