"use client";

import { FileText, ImageOff, Mic, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { MessageAttachment } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const imageTypes = new Set(["image", "sticker", "story_reply", "story_mention", "share", "animated_image"]);
const videoTypes = new Set(["video", "reel", "ig_reel"]);

/** How the inbox shows an attachment type; exported for tests. */
export function attachmentView(type: string): "image" | "video" | "audio" | "file" {
  if (imageTypes.has(type)) return "image";
  if (videoTypes.has(type)) return "video";
  if (type === "audio") return "audio";
  return "file";
}

/**
 * Images, voice notes, videos and the story a customer answered. Instagram's media URLs expire after a while, so a URL
 * that is missing or no longer loads becomes a placeholder rather than a broken image.
 */
export function Attachments({ items, outbound }: { items: MessageAttachment[]; outbound: boolean }) {
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", outbound ? "justify-end" : "justify-start")}>
      {items.map((a, i) => (
        <Attachment key={`${a.type}-${i}`} attachment={a} />
      ))}
    </div>
  );
}

function Attachment({ attachment: a }: { attachment: MessageAttachment }) {
  const t = useTranslations("inbox.attachment");
  const [broken, setBroken] = useState(false);
  const view = attachmentView(a.type);
  const label = t.has(`types.${a.type}`) ? t(`types.${a.type}` as "types.image") : t("types.file");
  const story = a.type === "story_reply" || a.type === "story_mention";

  if (!a.url || broken) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <ImageOff className="size-4" aria-hidden />
        {t("expired", { type: label })}
      </span>
    );
  }

  if (view === "audio") {
    return (
      <figure className="flex items-center gap-2 rounded-2xl bg-bubble-in px-2 py-1.5">
        <Mic className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <audio controls preload="none" src={a.url} aria-label={label} onError={() => setBroken(true)} className="h-9 max-w-60" />
      </figure>
    );
  }

  if (view === "file") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-surface-muted">
        <FileText className="size-4" aria-hidden />
        {label}
      </a>
    );
  }

  return (
    <figure className="space-y-1">
      {story ? <figcaption className="text-xs text-muted-foreground">{label}</figcaption> : null}
      <a href={a.url} target="_blank" rel="noreferrer" aria-label={label} className={cn("relative block overflow-hidden rounded-2xl bg-surface-muted", story ? "h-48 w-28" : "max-h-72 w-56")}>
        {view === "video" ? (
          <>
            <video src={a.url} preload="metadata" muted playsInline onError={() => setBroken(true)} className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
              <Play className="size-8" aria-hidden />
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs that expire; next/image would re-host them.
          <img src={a.url} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
        )}
      </a>
    </figure>
  );
}
