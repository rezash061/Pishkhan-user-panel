"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authPost } from "@/lib/api/client";

export function LogoutButton({ compact }: { compact?: boolean }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    await authPost("logout").catch(() => undefined);
    window.location.assign("/login");
  };
  return (
    <Button variant="ghost" size={compact ? "icon" : "sm"} onClick={logout} loading={busy} aria-label={t("logout")}>
      {busy ? null : <LogOut aria-hidden />}
      {compact ? null : t("logout")}
    </Button>
  );
}
