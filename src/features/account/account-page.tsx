"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, ShieldCheck, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { CodeInput } from "@/components/ui/phone-input";
import { LogoutButton } from "@/features/auth/logout-button";
import { useSupportSession } from "@/features/support/support";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { Me } from "@/lib/api/types";
import { digitsOnly, toPersianDigits } from "@/lib/i18n/digits";
import { formatDate, formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { groupMobile } from "@/lib/phone";

export function AccountPage({ initialMe }: { initialMe: Me }) {
  const t = useTranslations("support");
  const support = useSupportSession();
  const me = useQuery({ queryKey: qk.me, initialData: initialMe, queryFn: async () => unwrap(await api.GET("/api/v1/me")) });
  return (
    <div className="space-y-5">
      <Profile me={me.data} />
      {support ? (
        // The backend refuses password, two-step and session changes under a support session.
        <p className="rounded-xl border bg-surface-muted p-4 text-sm text-muted-foreground">{t("securityHidden")}</p>
      ) : (
        <>
          <Password me={me.data} />
          <Totp me={me.data} />
          <Sessions />
        </>
      )}
      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </div>
  );
}

function useMeUpdated() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.me });
}

function Profile({ me }: { me: Me }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const refresh = useMeUpdated();
  const [name, setName] = useState(me.displayName ?? "");
  const save = useMutation({
    mutationFn: async () => unwrap(await api.PATCH("/api/v1/me", { body: { displayName: name.trim() || null } })),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title={t("account.profile")} description={t("account.memberSince", { date: formatDate(me.createdAt) })} />
      <CardBody>
        <form
          className="max-w-md space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("account.displayName")} htmlFor="display-name">
            <Input id="display-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label={t("account.phone")} htmlFor="phone">
            <Input id="phone" dir="ltr" readOnly disabled value={toPersianDigits(groupMobile(me.phone))} />
          </Field>
          <Button type="submit" loading={save.isPending}>
            {t("common.save")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Password({ me }: { me: Me }) {
  const t = useTranslations("account");
  const errorMessage = useErrorMessage();
  const refresh = useMeUpdated();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { response, error } = await api.PUT("/api/v1/me/password", { body: { newPassword: next, currentPassword: me.hasPassword ? current : null } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      toast.success(t("passwordChanged"));
      setCurrent("");
      setNext("");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <CardHeader title={t("password")} description={me.hasPassword ? t("passwordSet") : t("passwordNotSet")} />
      <CardBody>
        <form
          className="max-w-md space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (next.length >= 8) save.mutate();
          }}
        >
          {me.hasPassword ? (
            <Field label={t("currentPassword")} htmlFor="current-password">
              <Input id="current-password" type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
          ) : null}
          <Field label={t("newPassword")} htmlFor="new-password">
            <Input id="new-password" type="password" dir="ltr" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={save.isPending} disabled={next.length < 8}>
            {me.hasPassword ? t("changePassword") : t("setPassword")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Totp({ me }: { me: Me }) {
  const t = useTranslations("account");
  const errorMessage = useErrorMessage();
  const refresh = useMeUpdated();
  const [setup, setSetup] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [code, setCode] = useState("");

  const begin = useMutation({
    mutationFn: async () => unwrap(await api.POST("/api/v1/auth/totp/setup")),
    onSuccess: setSetup,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const enable = useMutation({
    mutationFn: async () => {
      const { response, error } = await api.POST("/api/v1/auth/totp/enable", { body: { code: digitsOnly(code) } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      toast.success(t("totpEnabled"));
      setSetup(null);
      setCode("");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: async () => {
      const { response, error } = await api.POST("/api/v1/auth/totp/disable", { body: { code: digitsOnly(code) } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      toast.success(t("totpDisabled"));
      setCode("");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            {t("totp")}
          </span>
        }
        description={me.totpEnabled ? t("totpOn") : t("totpOff")}
        action={me.totpEnabled ? <Badge tone="success">{t("totpOn")}</Badge> : null}
      />
      <CardBody className="space-y-4">
        {me.totpEnabled ? (
          <div className="flex max-w-md flex-wrap items-end gap-2">
            <Field label={t("totpCode")} htmlFor="totp-off" className="flex-1">
              <CodeInput id="totp-off" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button variant="outline" loading={disable.isPending} disabled={digitsOnly(code).length !== 6} onClick={() => disable.mutate()}>
              {t("totpDisable")}
            </Button>
          </div>
        ) : setup ? (
          <div className="max-w-md space-y-3">
            <p className="text-sm text-muted-foreground">{t("totpScan")}</p>
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="text-xs text-muted-foreground">{t("totpSecret")}</p>
              <p className="font-mono text-sm break-all select-all" dir="ltr">
                {setup.secret}
              </p>
            </div>
            <a href={setup.otpAuthUri} className="inline-block text-sm text-primary hover:underline">
              {t("totpOpenApp")}
            </a>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("totpCode")} htmlFor="totp-on" className="flex-1">
                <CodeInput id="totp-on" value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <Button loading={enable.isPending} disabled={digitsOnly(code).length !== 6} onClick={() => enable.mutate()}>
                {t("totpEnable")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" loading={begin.isPending} onClick={() => begin.mutate()}>
            {t("totpEnable")}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function Sessions() {
  const t = useTranslations("account");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: async () => unwrap(await api.GET("/api/v1/me/sessions")) });
  const revoke = useMutation({
    mutationFn: async (sessionId: string) => {
      const { response, error } = await api.DELETE("/api/v1/me/sessions/{sessionId}", { params: { path: { sessionId } } });
      if (!response.ok) unwrap({ error, response });
    },
    onSuccess: () => {
      toast.success(t("revoked"));
      void qc.invalidateQueries({ queryKey: qk.sessions });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader title={t("sessions")} description={t("sessionsSubtitle")} />
      <CardBody className="divide-y p-0 sm:p-0">
        {sessions.isPending ? <Skeleton className="m-4 h-12" /> : null}
        {sessions.data?.map((s) => {
          const mobile = /mobile|android|iphone/i.test(s.userAgent ?? "");
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              {mobile ? <Smartphone className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : <Laptop className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" dir="ltr" style={{ textAlign: "right" }} title={s.userAgent ?? ""}>
                  {s.userAgent ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("lastUsed", { time: formatRelative(s.lastUsedAt) })}
                  {s.ip ? <span dir="ltr"> · {s.ip}</span> : null}
                </p>
              </div>
              {s.current ? (
                <Badge tone="primary">{t("thisDevice")}</Badge>
              ) : (
                <Button variant="ghost" size="sm" className="text-danger" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                  {t("revoke")}
                </Button>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
