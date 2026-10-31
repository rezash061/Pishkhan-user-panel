"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FlaskConical, MessageCircleMore, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { qk } from "@/lib/api/keys";
import type { Rule, TriggerKind } from "@/lib/api/types";
import { triggerKinds } from "@/lib/api/types";
import { formatNumber } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { toRuleRequest, useRules, useSaveRule } from "./data";
import { triggerIcons } from "./rule-editor";
import { RuleTester } from "./sandbox";

/** Rules in the order the engine tries them: higher priority first, then older first (backend `Order`). */
export function engineOrder(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => Number(b.priority) - Number(a.priority) || a.createdAt.localeCompare(b.createdAt));
}

export function RulesPage() {
  const t = useTranslations("automations");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.automationWrite);
  const rules = useRules(ws);
  const channels = useChannels(ws);
  const save = useSaveRule(ws);
  const [channel, setChannel] = useState("");
  const [testing, setTesting] = useState(false);
  const base = `/w/${ws}/automations`;

  const update = (rule: Rule, patch: Partial<Rule>) => {
    const next = { ...rule, ...patch };
    // Optimistic: the switch flips at once and rolls back if the server refuses.
    qc.setQueryData<Rule[]>(qk.rules(ws), (list) => list?.map((r) => (r.id === rule.id ? next : r)));
    return save.mutateAsync({ id: rule.id, body: toRuleRequest(next) }).catch((e: unknown) => {
      qc.setQueryData<Rule[]>(qk.rules(ws), (list) => list?.map((r) => (r.id === rule.id ? rule : r)));
      toast.error(errorMessage(e));
    });
  };

  /** Moves a rule one place within its trigger group by giving the group descending priorities. */
  const move = async (group: Rule[], index: number, by: -1 | 1) => {
    const order = [...group];
    const [item] = order.splice(index, 1);
    order.splice(index + by, 0, item!);
    const top = Math.max(order.length * 10, ...order.map((r) => Number(r.priority)));
    const changes = order.map((r, i) => ({ rule: r, priority: Math.min(1000, top - i * 10) })).filter((c) => Number(c.rule.priority) !== c.priority);
    for (const c of changes) await update(c.rule, { priority: c.priority });
  };

  const list = engineOrder((rules.data ?? []).filter((r) => !channel || r.channelAccountId === channel || r.channelAccountId === null));
  const groups = triggerKinds.map((k) => ({ kind: k, rules: list.filter((r) => r.triggerKind === k) })).filter((g) => g.rules.length);
  const channelName = (id: string | null) => {
    const c = channels.data?.find((x) => x.id === id);
    return c ? `@${c.username ?? c.displayName ?? c.externalId}` : t("editor.allAccounts");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {(channels.data?.length ?? 0) > 1 ? (
          <Select aria-label={t("rules.filterAccount")} className="h-10 w-56" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">{t("rules.allAccounts")}</option>
            {channels.data!.map((c) => (
              <option key={c.id} value={c.id}>
                @{c.username ?? c.displayName}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">{t("rules.subtitle")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTesting(true)}>
            <FlaskConical aria-hidden />
            {t("test.open")}
          </Button>
        {writable ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/comments/new`} className={buttonVariants({ variant: "outline" })}>
              <MessageCircleMore aria-hidden />
              {t("rules.commentWizard")}
            </Link>
            <Link href={`${base}/rules/new`} className={buttonVariants()}>
              <Plus aria-hidden />
              {t("rules.new")}
            </Link>
          </div>
        ) : null}
        </div>
      </div>
      {testing ? <RuleTester open onClose={() => setTesting(false)} /> : null}

      {rules.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : rules.isError ? (
        <Card>
          <EmptyState title={errorMessage(rules.error)} action={<Button variant="outline" onClick={() => rules.refetch()}>{t("retry")}</Button>} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Workflow />}
            title={t("rules.empty")}
            body={t("rules.emptyBody")}
            action={
              writable ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={`${base}/comments/new`} className={buttonVariants()}>
                    {t("rules.commentWizard")}
                  </Link>
                  <Link href={`${base}/rules/new?trigger=dm_keyword`} className={buttonVariants({ variant: "outline" })}>
                    {t("rules.templateKeyword")}
                  </Link>
                  <Link href={`${base}/rules/new?trigger=new_conversation`} className={buttonVariants({ variant: "outline" })}>
                    {t("rules.templateWelcome")}
                  </Link>
                </div>
              ) : null
            }
          />
        </Card>
      ) : (
        groups.map((g) => {
          const Icon = triggerIcons[g.kind as TriggerKind];
          return (
            <section key={g.kind} aria-labelledby={`group-${g.kind}`} className="space-y-2">
              <h2 id={`group-${g.kind}`} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Icon className="size-4" aria-hidden />
                {t(`triggers.${g.kind}`)}
                <span className="font-normal">({formatNumber(g.rules.length)})</span>
              </h2>
              <Card className="divide-y overflow-hidden">
                {g.rules.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <Link href={`${base}/rules/${r.id}`} className="min-w-0 flex-1 space-y-1 rounded-lg outline-offset-4">
                      <p className="flex items-center gap-2 truncate font-medium">
                        <span className="truncate">{r.name}</span>
                        {!r.enabled ? <Badge>{t("rules.off")}</Badge> : null}
                      </p>
                      <RuleSummary rule={r} channel={channelName(r.channelAccountId)} />
                    </Link>
                    {writable && g.rules.length > 1 ? (
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon-sm" className="size-7" aria-label={t("rules.moveUp", { name: r.name })} disabled={i === 0 || save.isPending} onClick={() => void move(g.rules, i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="size-7" aria-label={t("rules.moveDown", { name: r.name })} disabled={i === g.rules.length - 1 || save.isPending} onClick={() => void move(g.rules, i, 1)}>
                          <ArrowDown />
                        </Button>
                      </div>
                    ) : null}
                    <Switch label={t("rules.toggle", { name: r.name })} checked={r.enabled} disabled={!writable} onChange={(enabled) => void update(r, { enabled })} />
                  </div>
                ))}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}

function RuleSummary({ rule, channel }: { rule: Rule; channel: string }) {
  const t = useTranslations("automations");
  const keywords = rule.trigger.match === "pattern" ? (rule.trigger.pattern ? [rule.trigger.pattern] : []) : (rule.trigger.keywords ?? []);
  const scope = rule.trigger.scope;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{channel}</span>
      {keywords.slice(0, 3).map((k) => (
        <span key={k} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-foreground" dir="auto">
          {k}
        </span>
      ))}
      {keywords.length > 3 ? <span>+{formatNumber(keywords.length - 3)}</span> : null}
      {scope && scope !== "all" ? <span>· {t(`scope.${scope}` as "scope.post")}</span> : null}
      <span>· {rule.actions.map((a) => t(`actions.kinds.${a.kind}` as "actions.kinds.send_message")).join("، ")}</span>
    </div>
  );
}
