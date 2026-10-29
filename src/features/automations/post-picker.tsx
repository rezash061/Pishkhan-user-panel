"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Check, Film, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/api/keys";
import type { Media } from "@/lib/api/types";
import { formatDate } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { cn } from "@/lib/cn";

export function useMediaPages(ws: string, channelId: string | null) {
  return useInfiniteQuery({
    queryKey: [...qk.media(ws, channelId ?? "none"), "pages"],
    enabled: Boolean(channelId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/v1/workspaces/{workspaceId}/channels/{channelId}/media", {
          params: { path: { workspaceId: ws, channelId: channelId! }, query: { limit: 18, ...(pageParam ? { cursor: pageParam } : {}) } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? null,
    staleTime: 60_000,
  });
}

/** Grid of the account's posts and reels to bind a comment rule to (plan 3.4: post picker from account media). */
export function PostPicker({ ws, channelId, value, onChange, disabled }: { ws: string; channelId: string | null; value: string | null; onChange: (media: Media) => void; disabled?: boolean }) {
  const t = useTranslations("automations.post");
  const errorMessage = useErrorMessage();
  const media = useMediaPages(ws, channelId);
  const items = media.data?.pages.flatMap((p) => p.items) ?? [];

  if (!channelId) return <p className="text-sm text-muted-foreground">{t("pickAccount")}</p>;
  if (media.isPending)
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  if (media.isError) return <EmptyState title={errorMessage(media.error)} action={<Button variant="outline" onClick={() => media.refetch()}>{t("retry")}</Button>} />;
  if (!items.length) return <EmptyState icon={<ImageOff />} title={t("empty")} />;

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => {
          const selected = m.id === value;
          const thumb = m.thumbnailUrl ?? (m.mediaType === "VIDEO" ? null : m.mediaUrl);
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={m.caption?.slice(0, 80) || t("untitled", { date: m.timestamp ? formatDate(m.timestamp) : "" })}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={cn("relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-muted transition", selected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border")}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs are short-lived; next/image would cache them.
                <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center p-2 text-[11px] text-muted-foreground">{m.caption?.slice(0, 40) ?? ""}</span>
              )}
              {m.mediaType === "VIDEO" || m.mediaType === "REELS" ? <Film className="absolute end-1.5 top-1.5 size-4 text-white drop-shadow" aria-hidden /> : null}
              {selected ? (
                <span className="absolute inset-0 grid place-items-center bg-primary/30">
                  <Check className="size-7 text-white drop-shadow" aria-hidden />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {media.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" loading={media.isFetchingNextPage} onClick={() => media.fetchNextPage()}>
            {t("more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
