"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./field";

/** Iranian mobile input: LTR inside the RTL page, numeric keyboard, accepts Persian/Arabic digits and +98 (normalized on submit). */
export function PhoneInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <Input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} className={cn("text-left tracking-wide", className)} {...props} />;
}

/** One-time code input; `one-time-code` lets Android and iOS fill the SMS code. */
export function CodeInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      dir="ltr"
      maxLength={6}
      className={cn("text-center text-lg tracking-[0.5em]", className)}
      {...props}
    />
  );
}
