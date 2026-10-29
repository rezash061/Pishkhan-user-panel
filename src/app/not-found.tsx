import { SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default async function NotFound() {
  const t = await getTranslations("pages");
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <EmptyState
        icon={<SearchX />}
        title={t("notFound")}
        body={t("notFoundBody")}
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {t("home")}
          </Link>
        }
      />
    </main>
  );
}
