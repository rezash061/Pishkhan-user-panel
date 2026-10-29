"use client";

import { Clock, Lock, SendHorizontal, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { Conversation, QuickReply } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/i18n/format";
import { messagingWindow } from "./window";

export interface ComposerHandle {
  focus: () => void;
  setText: (text: string) => void;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const MAX_LENGTH = 1000;

/**
 * Reply box with the 24-hour window indicator (plan 3.3): open → countdown; 24 h–7 d → human-agent replies only;
 * later → blocked with an explanation. Typing «/» opens saved replies, filtered by shortcut.
 */
export const Composer = forwardRef<ComposerHandle, {
  conversation: Conversation;
  canReply: boolean;
  quickReplies: QuickReply[];
  quickRepliesHref: string;
  onSend: (text: string) => void;
}>(function Composer({ conversation, canReply, quickReplies, quickRepliesHref, onSend }, ref) {
  const t = useTranslations("inbox.composer");
  const [text, setText] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const now = useNow(30_000);
  const win = messagingWindow(conversation, now);
  const blocked = !canReply || win.kind === "closed" || win.kind === "none";

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    setText: (value: string) => {
      setText(value);
      requestAnimationFrame(() => area.current?.focus());
    },
  }));

  // Grow with the text up to a few lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const slash = text.startsWith("/") && !text.includes("\n") ? text.slice(1).trim().toLowerCase() : null;
  const matches = useMemo(
    () => (slash === null ? [] : quickReplies.filter((q) => q.shortcut.toLowerCase().includes(slash) || q.text.includes(slash)).slice(0, 6)),
    [slash, quickReplies],
  );
  const pickerOpen = slash !== null;

  const send = () => {
    const value = text.trim();
    if (!value || blocked) return;
    onSend(value);
    setText("");
  };

  const pick = (q: QuickReply) => {
    setText(q.text);
    setPickerIndex(0);
    area.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen && matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPickerIndex((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[pickerIndex] ?? matches[0]!);
        return;
      }
    }
    if (e.key === "Escape") {
      area.current?.blur();
      return;
    }
    // Enter sends on desktop; Shift+Enter (and the phone keyboard's return) adds a line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      send();
    }
  };

  const countdown = win.kind === "open" || win.kind === "human" ? formatCountdown(win.until, now) : null;

  return (
    <div className="shrink-0 border-t bg-surface p-2 safe-bottom sm:p-3">
      <div
        className={cn(
          "mb-2 flex items-center gap-1.5 px-1 text-xs",
          win.kind === "open" ? "text-muted-foreground" : win.kind === "human" ? "text-[oklch(0.5_0.12_70)] dark:text-warning" : "text-danger",
        )}
      >
        {win.kind === "closed" || !canReply ? <Lock className="size-3.5 shrink-0" aria-hidden /> : <Clock className="size-3.5 shrink-0" aria-hidden />}
        <span>
          {!canReply
            ? t("noPermission")
            : win.kind === "open"
              ? t("windowOpen", { time: countdown ?? "" })
              : win.kind === "human"
                ? t("windowHuman", { time: countdown ?? "" })
                : win.kind === "closed"
                  ? t("windowClosed")
                  : t("windowNone")}
        </span>
      </div>

      {pickerOpen ? (
        <div role="listbox" aria-label={t("quickReplies")} className="mb-2 max-h-56 overflow-y-auto rounded-xl border bg-surface shadow-lg">
          {matches.length === 0 ? (
            <div className="flex items-center justify-between gap-2 p-3 text-sm text-muted-foreground">
              <span>{t("noQuickReplies")}</span>
              <Link href={quickRepliesHref} className="text-primary hover:underline">
                {t("manageQuickReplies")}
              </Link>
            </div>
          ) : (
            matches.map((q, i) => (
              <button
                key={q.id}
                type="button"
                role="option"
                aria-selected={i === pickerIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(q)}
                className={cn("block w-full px-3 py-2 text-start text-sm", i === pickerIndex ? "bg-primary-soft" : "hover:bg-surface-muted")}
              >
                <span className="font-mono text-xs text-primary" dir="ltr">
                  /{q.shortcut}
                </span>
                <span className="block truncate text-muted-foreground">{q.text}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={t("quickReplies")}
          disabled={blocked}
          onClick={() => {
            setText("/");
            area.current?.focus();
          }}
        >
          <Zap />
        </Button>
        <label htmlFor="composer" className="sr-only">
          {t("placeholder")}
        </label>
        <textarea
          id="composer"
          ref={area}
          rows={1}
          dir="auto"
          maxLength={MAX_LENGTH}
          value={text}
          disabled={blocked}
          onChange={(e) => {
            setText(e.target.value);
            setPickerIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border bg-surface-muted px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:outline-none disabled:opacity-60"
        />
        <Button size="icon" className="shrink-0" aria-label={t("send")} disabled={blocked || !text.trim() || pickerOpen} onClick={send}>
          <SendHorizontal className="-scale-x-100" />
        </Button>
      </div>
    </div>
  );
});
