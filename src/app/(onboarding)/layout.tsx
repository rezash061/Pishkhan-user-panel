import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <Logo className="mb-8" />
      {children}
    </main>
  );
}
