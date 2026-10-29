"use client";

import { AlertCircle, Bot, Check, CheckCheck, Clock, RotateCcw, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTime } from "@/lib/i18n/format";
import { useCodeMessage } from "@/lib/i18n/use-error-message";
import type { OptimisticMessage } from "./data";

function StatusIcon({ message }: { message: OptimisticMessage }) {
  const t = useTranslations("inbox.messageStatus");
  if (message.local === "sending" || message.status === "queued") return <Clock className="size-3.5" aria-label={t("queued")} />;
  if (message.local === "failed" || message.status === "failed") return <AlertCircle className="size-3.5 text-danger" aria-label={t("failed")} />;
  if (message.status === "read") return <CheckCheck className="size-3.5 text-sky-300" aria-label={t("read")} />;
  return <Check className="size-3.5" aria-label={t("sent")} />;
}

/** One message. Outbound bubbles say who sent them (rule, AI or a teammate) and show delivery status (plan 3.3). */
export function MessageBubble({ message, senderName, onRetry }: { message: OptimisticMessage; senderName: (userId: string | null) => string; onRetry?: () => void }) {
  const t = useTranslations("inbox");
  const codeMessage = useCodeMessage();
  const outbound = message.direction === "outbound";
  const failed = message.local === "failed" || message.status === "failed";
  const kindLabel = message.kind !== "text" && t.has(`kind.${message.kind}`) ? t(`kind.${message.kind}` as "kind.text") : null;

  const by =
    message.handledBy === "rule" ? (
      <span className="inline-flex items-center gap-1">
        <Workflow className="size-3" aria-hidden />
        {t("handledBy.rule")}
      </span>
    ) : message.handledBy === "ai" ? (
      <span className="inline-flex items-center gap-1">
        <Bot className="size-3" aria-hidden />
        {t("handledBy.ai")}
      </span>
    ) : message.handledBy === "human" ? (
      <span>{senderName(message.sentBy)}</span>
    ) : null;

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] space-y-1 sm:max-w-[70%]", outbound ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-7 whitespace-pre-wrap break-words",
            outbound ? "rounded-ee-md bg-bubble-out text-bubble-out-foreground" : "rounded-es-md bg-bubble-in",
            message.local === "sending" && "opacity-70",
            failed && "ring-2 ring-danger/60",
          )}
          dir="auto"
        >
          {kindLabel ? <span className={cn("mb-0.5 block text-xs", outbound ? "opacity-80" : "text-muted-foreground")}>[{kindLabel}]</span> : null}
          {message.text}
        </div>
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] text-muted-foreground", outbound ? "justify-end" : "justify-start")}>
          {outbound && by ? by : null}
          {message.tag === "HUMAN_AGENT" ? <span title={t("humanAgentTag")}>· HUMAN_AGENT</span> : null}
          <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>
            {formatTime(message.createdAt)}
          </time>
          {outbound ? <StatusIcon message={message} /> : null}
        </div>
        {failed ? (
          <div className="flex items-center justify-end gap-2 px-1 text-xs text-danger">
            <span>{codeMessage(message.errorCode) ?? t("messageStatus.failed")}</span>
            {onRetry ? (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-danger" onClick={onRetry}>
                <RotateCcw aria-hidden />
                {t("composer.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
