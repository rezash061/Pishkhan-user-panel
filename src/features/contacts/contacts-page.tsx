"use client";

import { FileSpreadsheet, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import type { Contact } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatRelative } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { consentChannels, useContacts, useSegments, useTags, type ContactFilter } from "./data";
import { ExportsDialog } from "./exports";
import { TagChip, tagColorMap } from "./tag";

/** Name to show: their name, else @username, else «مشتری ۱a2b» from the end of the id (same rule as the inbox). */
export function contactLabel(c: Pick<Contact, "id" | "displayName" | "username">, customer: (short: string) => string): { title: string; handle: string | null } {
  const name = c.displayName?.trim();
  const username = c.username?.trim();
  if (name) return { title: name, handle: username ? `@${username}` : null };
  if (username) return { title: `@${username}`, handle: null };
  return { title: customer(toPersianDigits(c.id.replace(/-/g, "").slice(-4))), handle: null };
}

export function ContactsPage() {
  const t = useTranslations("contacts");
  const tInbox = useTranslations("inbox");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const tag = params.get("tag") ?? "";
  const segmentId = params.get("segment") ?? "";
  const channelAccountId = params.get("channel") ?? "";
  const phone = params.get("phone") ?? "";
  const consent = params.get("consent") ?? "";
  // A «crm_export» notification links to ?export={id}: open the exports sheet on that file.
  const exportId = params.get("export") ?? "";
  const [exportsOpen, setExportsOpen] = useState(false);

  // Filters live in the URL so the tags and segments pages can link straight to a filtered list.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const filter: ContactFilter = { q: query, tag, segmentId, channelAccountId, hasPhone: phone === "yes" ? true : phone === "no" ? false : undefined, consent };
  const contacts = useContacts(ws, filter);
  const tags = useTags(ws);
  const segments = useSegments(ws);
  const channels = useChannels(ws);
  const colors = tagColorMap(tags.data);
  const items = contacts.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = Boolean(query || tag || segmentId || channelAccountId || phone || consent);
  const channelName = new Map((channels.data ?? []).map((c) => [c.id, c.username ? `@${c.username}` : (c.displayName ?? "")]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={t("search")} placeholder={t("searchPlaceholder")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label={t("filters.tag")} className="w-40" value={tag} onChange={(e) => setParam("tag", e.target.value)}>
          <option value="">{t("filters.allTags")}</option>
          {(tags.data ?? []).map((x) => (
            <option key={x.name} value={x.name}>
              {x.name}
            </option>
          ))}
        </Select>
        <Select aria-label={t("filters.segment")} className="w-40" value={segmentId} onChange={(e) => setParam("segment", e.target.value)}>
          <option value="">{t("filters.allSegments")}</option>
          {(segments.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {(channels.data?.length ?? 0) > 1 ? (
          <Select aria-label={t("filters.channel")} className="w-44" value={channelAccountId} onChange={(e) => setParam("channel", e.target.value)}>
            <option value="">{t("filters.allChannels")}</option>
            {channels.data!.map((c) => (
              <option key={c.id} value={c.id}>
                {channelName.get(c.id)}
              </option>
            ))}
          </Select>
        ) : null}
        <Select aria-label={t("filters.phone")} className="w-36" value={phone} onChange={(e) => setParam("phone", e.target.value)}>
          <option value="">{t("filters.anyPhone")}</option>
          <option value="yes">{t("filters.withPhone")}</option>
          <option value="no">{t("filters.withoutPhone")}</option>
        </Select>
        <Select aria-label={t("filters.consent")} className="w-40" value={consent} onChange={(e) => setParam("consent", e.target.value)}>
          <option value="">{t("filters.anyConsent")}</option>
          {consentChannels.map((c) => (
            <option key={c} value={c}>
              {t("filters.consentTo", { channel: t(`consent.channels.${c}`) })}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => setExportsOpen(true)}>
          <FileSpreadsheet aria-hidden />
          {t("exports.open")}
        </Button>
      </div>
      <ExportsDialog
        open={exportsOpen || Boolean(exportId)}
        onClose={() => {
          setExportsOpen(false);
          if (exportId) setParam("export", "");
        }}
        filter={filter}
        filtered={filtered}
        highlight={exportId}
      />

      <Card className={cn("divide-y overflow-hidden", contacts.isPlaceholderData && "opacity-60")}>
        {contacts.isPending ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : contacts.isError ? (
          <EmptyState title={errorMessage(contacts.error)} action={<Button variant="outline" onClick={() => contacts.refetch()}>{t("retry")}</Button>} />
        ) : items.length === 0 ? (
          filtered ? <EmptyState icon={<Search />} title={t("noResults")} /> : <EmptyState icon={<UsersRound />} title={t("empty")} body={t("emptyBody")} />
        ) : (
          items.map((c) => {
            const { title, handle } = contactLabel(c, (short) => tInbox("customer", { id: short }));
            return (
              <Link key={c.id} href={`/w/${ws}/contacts/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-muted/50 sm:p-4">
                <Avatar name={title.replace(/^@/, "")} src={c.profilePicUrl} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate font-medium" dir="auto">
                      {title}
                    </span>
                    {handle ? (
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {handle}
                      </span>
                    ) : null}
                  </p>
                  {c.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 4).map((name) => (
                        <TagChip key={name} name={name} color={colors.get(name)} />
                      ))}
                      {c.tags.length > 4 ? <span className="text-xs text-muted-foreground">{t("moreTags", { n: toPersianDigits(c.tags.length - 4) })}</span> : null}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{c.lastSeenAt ? formatRelative(c.lastSeenAt) : t("neverWrote")}</span>
              </Link>
            );
          })
        )}
      </Card>
      {contacts.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => contacts.fetchNextPage()} loading={contacts.isFetchingNextPage}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
