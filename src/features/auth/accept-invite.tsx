"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api/client";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export function AcceptInvite({ token }: { token: string }) {
  const t = useTranslations("invite");
  const errorMessage = useErrorMessage();
  const accept = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/invitations/{token}/accept", { params: { path: { token } } })),
    onSuccess: (result) => window.location.assign(`/w/${result.workspaceId}`),
  });
  return (
    <div className="space-y-3">
      {accept.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(accept.error)}
        </p>
      ) : null}
      <Button size="lg" className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
        {t("accept")}
      </Button>
    </div>
  );
}
