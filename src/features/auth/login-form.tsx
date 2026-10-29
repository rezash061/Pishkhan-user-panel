"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { CodeInput, PhoneInput } from "@/components/ui/phone-input";
import { solveAltcha } from "@/lib/altcha";
import { authPost } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { digitsOnly, toPersianDigits } from "@/lib/i18n/digits";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { groupMobile, normalizeIranMobile } from "@/lib/phone";

type Step = "phone" | "code" | "password";

interface OtpRequested {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** Phone → SMS code login (sign-up is the same flow), or phone + password (+ TOTP when enabled). Plan 2.2. */
export function LoginForm({ next, expired }: { next: string | null; expired: boolean }) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<Step>("phone");
  const [phoneText, setPhoneText] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(expired ? t("sessionExpired") : null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const altcha = useRef<Promise<string> | null>(null);

  // Solve the proof of work in the background as soon as the page opens, so "get code" feels instant.
  const prepareAltcha = () => {
    altcha.current = solveAltcha();
    altcha.current.catch(() => (altcha.current = null));
  };
  useEffect(prepareAltcha, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const finish = (isNewUser: boolean) => {
    // A full navigation so the request proxy and server components see the new session cookies.
    window.location.assign(next ?? (isNewUser ? "/onboarding/workspace" : "/workspaces"));
  };

  const requestCode = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      if (!altcha.current) prepareAltcha();
      const proof = await altcha.current!;
      altcha.current = null;
      const result = await authPost<OtpRequested>("otp-request", { phone: target, altcha: proof });
      setResendIn(Number(result.resendAfterSeconds) || 60);
      setStep("code");
    } catch (e) {
      setError(errorMessage(e instanceof ApiError ? e : new ApiError(0, { code: "validation.altcha.invalid" })));
    } finally {
      setBusy(false);
      prepareAltcha();
    }
  };

  const onPhone = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeIranMobile(phoneText);
    if (!normalized) {
      setError(errorMessage(new ApiError(400, { code: "validation.phone.invalid" })));
      return;
    }
    setPhone(normalized);
    await requestCode(normalized);
  };

  const onCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authPost<{ isNewUser: boolean }>("otp-verify", { phone, code: digitsOnly(code) });
      finish(result.isNewUser);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeIranMobile(phoneText);
    if (!normalized) {
      setError(errorMessage(new ApiError(400, { code: "validation.phone.invalid" })));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authPost<{ isNewUser: boolean }>("password-login", {
        phone: normalized,
        password,
        totpCode: needTotp ? digitsOnly(totp) : null,
      });
      finish(result.isNewUser);
    } catch (err) {
      if (err instanceof ApiError && err.code === "auth.totp.required") {
        setNeedTotp(true);
        setError(null);
      } else {
        setError(errorMessage(err));
      }
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {step === "code" && phone ? t("codeSentTo", { phone: toPersianDigits(groupMobile(phone)) }) : t("subtitle")}
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {step === "phone" ? (
          <form onSubmit={onPhone} className="space-y-4" noValidate>
            <Field label={t("phone")} htmlFor="phone">
              <PhoneInput id="phone" name="phone" required autoFocus placeholder="0912 000 0000" value={phoneText} onChange={(e) => setPhoneText(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {t("getCode")}
            </Button>
            <Button variant="link" className="w-full" onClick={() => { setStep("password"); setError(null); }}>
              {t("withPassword")}
            </Button>
          </form>
        ) : null}

        {step === "code" ? (
          <form onSubmit={onCode} className="space-y-4" noValidate>
            <Field label={t("code")} htmlFor="code">
              <CodeInput id="code" name="code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={digitsOnly(code).length !== 6}>
              {t("verify")}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button variant="link" size="sm" className="px-0" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>
                {t("changePhone")}
              </Button>
              {resendIn > 0 ? (
                <span className="text-muted-foreground">{t("resendIn", { seconds: toPersianDigits(resendIn) })}</span>
              ) : (
                <Button variant="link" size="sm" className="px-0" disabled={busy} onClick={() => phone && requestCode(phone)}>
                  {t("resend")}
                </Button>
              )}
            </div>
          </form>
        ) : null}

        {step === "password" ? (
          <form onSubmit={onPassword} className="space-y-4" noValidate>
            <Field label={t("phone")} htmlFor="phone">
              <PhoneInput id="phone" name="phone" required autoFocus placeholder="0912 000 0000" value={phoneText} onChange={(e) => setPhoneText(e.target.value)} />
            </Field>
            <Field label={t("password")} htmlFor="password">
              <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {needTotp ? (
              <Field label={t("totpCode")} htmlFor="totp" hint={t("totpHint")}>
                <CodeInput id="totp" name="totp" autoFocus value={totp} onChange={(e) => setTotp(e.target.value)} />
              </Field>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {t("verify")}
            </Button>
            <Button variant="link" className="w-full" onClick={() => { setStep("phone"); setNeedTotp(false); setError(null); }}>
              {t("withOtp")}
            </Button>
          </form>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">{t("terms")}</p>
      </CardBody>
    </Card>
  );
}
