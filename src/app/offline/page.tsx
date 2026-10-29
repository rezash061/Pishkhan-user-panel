import { WifiOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/misc";

export default async function OfflinePage() {
  const t = await getTranslations("pages");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<WifiOff />} title={t("offline")} body={t("offlineBody")} />
    </main>
  );
}
