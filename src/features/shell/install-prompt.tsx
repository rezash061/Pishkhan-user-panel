"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pk-install-dismissed";

/** Android install prompt and iOS "Add to Home Screen" hint (plan section 4). Dismissal is remembered per browser. */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent));
  const [blocked] = useState(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    return dismissed || window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone);
  });
  const [hidden, setHidden] = useState(blocked || !ios);

  useEffect(() => {
    if (blocked) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [blocked]);

  if (hidden || (!event && !ios)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-t bg-primary-soft px-4 py-2.5 text-sm lg:hidden">
      <Download className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("install")}</p>
        <p className="text-xs text-muted-foreground">{ios ? t("iosHint") : t("installBody")}</p>
      </div>
      {event ? (
        <Button size="sm" onClick={async () => { await event.prompt(); dismiss(); }}>
          {t("installButton")}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={dismiss}>
        {t("dismiss")}
      </Button>
    </div>
  );
}
