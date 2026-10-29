import { useTranslations } from "next-intl";
import { toPersianDigits } from "@/lib/i18n/digits";
import { cn } from "@/lib/cn";

/** Phase 1 onboarding: workspace → Instagram. Template, import, teach and test steps arrive with their backend modules. */
export function Stepper({ step, total = 2 }: { step: number; total?: number }) {
  const t = useTranslations("onboarding");
  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs text-muted-foreground">{t("stepOf", { step: toPersianDigits(step), total: toPersianDigits(total) })}</p>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />
        ))}
      </div>
    </div>
  );
}
