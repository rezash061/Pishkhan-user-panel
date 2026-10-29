import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AcceptInvite } from "@/features/auth/accept-invite";
import { hasSession } from "@/lib/auth/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const signedIn = await hasSession();
  return (
    <Card>
      <CardBody className="space-y-4">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        {signedIn ? (
          <AcceptInvite token={token} />
        ) : (
          <>
            <p className="text-sm">{t("loginFirst")}</p>
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
              {t("login")}
            </Link>
          </>
        )}
      </CardBody>
    </Card>
  );
}
