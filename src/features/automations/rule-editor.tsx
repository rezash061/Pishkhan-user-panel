"use client";

import { AtSign, ChevronDown, Moon, MessageCircleMore, MessageSquareText, MessagesSquare, MousePointerClick, Radio, Share2, Sparkles, Trash2, CircleDot, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton, Switch } from "@/components/ui/misc";
import { PageContainer, StickyActions } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { CommentScope, Rule, TriggerKind } from "@/lib/api/types";
import { triggerKinds } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { ActionsEditor } from "./actions-editor";
import { useDeleteRule, useRule, useSaveRule } from "./data";
import { KeywordInput } from "./keyword-input";
import { PostPicker } from "./post-picker";
import { emptyRuleForm, formFromRule, hasPostScope, isCommentTrigger, keywordsAllowed, keywordsRequired, ruleProblems, ruleRequestFromForm, withTrigger, type RuleForm } from "./rule-form";
import { RuleStatsPanel } from "./rule-stats";

export const triggerIcons: Record<TriggerKind, LucideIcon> = {
  dm_keyword: MessageSquareText,
  comment_keyword: MessageCircleMore,
  comment_any: MessagesSquare,
  story_reply: CircleDot,
  story_mention: AtSign,
  live_comment: Radio,
  post_share: Share2,
  new_conversation: Sparkles,
  postback: MousePointerClick,
  outside_business_hours: Moon,
};

export function EditRule({ ruleId }: { ruleId: string }) {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const rule = useRule(workspace.id, ruleId);
  if (rule.isPending)
    return (
      <PageContainer className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </PageContainer>
    );
  if (rule.isError) return <EmptyState title={errorMessage(rule.error)} />;
  return <RuleEditor key={`${rule.data.id}-${rule.data.revision}`} rule={rule.data} />;
}

export function RuleEditor({ rule, initialTrigger }: { rule?: Rule; initialTrigger?: TriggerKind }) {
  const t = useTranslations("automations");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.automationWrite);
  const channels = useChannels(ws);
  const save = useSaveRule(ws);
  const remove = useDeleteRule(ws);
  const [form, setForm] = useState<RuleForm>(() => (rule ? formFromRule(rule) : emptyRuleForm(initialTrigger)));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/w/${ws}/automations`;

  const patch = (p: Partial<RuleForm>) => setForm((f) => ({ ...f, ...p }));
  const problems = ruleProblems(form);
  const serverError = save.error instanceof ApiError ? save.error : null;
  /** Client problem (after the first save attempt) or the server's field error, translated. */
  const fieldError = (path: string): string | null => (submitted ? codeMessage(problems[path]) : null) ?? codeMessage(serverError?.field(path));
  const generalError = save.error && !(serverError && Object.keys(serverError.fields).length) ? errorMessage(save.error) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(problems).length) {
      toast.error(t("editor.fixErrors"));
      return;
    }
    save.mutate(
      { id: rule?.id, body: ruleRequestFromForm(form) },
      {
        onSuccess: (saved) => {
          toast.success(t("editor.saved"));
          if (!rule) router.replace(`${base}/rules/${saved.id}`);
        },
      },
    );
  };

  const kind = form.triggerKind;
  const channelList = channels.data ?? [];
  const showScope = hasPostScope(kind);

  return (
    <PageContainer>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={base} className="text-sm text-muted-foreground hover:text-foreground">
              {t("title")}
            </Link>
            <h1 className="truncate text-xl font-bold sm:text-2xl">{rule ? rule.name : t("editor.newTitle")}</h1>
          </div>
          {rule && writable ? (
            <Button variant="outline" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              {t("editor.delete")}
            </Button>
          ) : null}
        </div>

        {!writable ? <p className="rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">{t("readOnly")}</p> : null}
        {generalError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {generalError}
          </p>
        ) : null}

        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("editor.name")} htmlFor="rule-name" hint={t("editor.nameHint")} error={fieldError("name")}>
              <Input id="rule-name" dir="auto" maxLength={100} disabled={!writable} value={form.name} onChange={(e) => patch({ name: e.target.value })} aria-invalid={Boolean(fieldError("name")) || undefined} />
            </Field>
            <Field label={t("editor.account")} htmlFor="rule-account" error={fieldError("channelAccountId")}>
              <Select id="rule-account" disabled={!writable} value={form.channelAccountId ?? ""} onChange={(e) => patch({ channelAccountId: e.target.value || null })}>
                <option value="">{t("editor.allAccounts")}</option>
                {channelList.map((c) => (
                  <option key={c.id} value={c.id}>
                    @{c.username ?? c.displayName ?? c.externalId}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="rule-enabled" label={t("editor.enabled")} checked={form.enabled} disabled={!writable} onChange={(enabled) => patch({ enabled })} />
              <label htmlFor="rule-enabled" className="text-sm">
                {form.enabled ? t("editor.enabledOn") : t("editor.enabledOff")}
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("editor.when")} description={t("editor.whenHint")} />
          <CardBody className="space-y-5">
            <div role="radiogroup" aria-label={t("editor.when")} className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {triggerKinds.map((k) => {
                const Icon = triggerIcons[k];
                const selected = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!writable}
                    onClick={() => setForm((f) => withTrigger(f, k))}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start text-sm transition-colors disabled:opacity-70",
                      selected ? "border-primary bg-primary-soft/60 ring-1 ring-primary" : "hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    <span className="font-medium leading-5">{t(`triggers.${k}`)}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{t(`triggerHints.${kind}`)}</p>

            {keywordsAllowed(kind) ? (
              <KeywordInput
                idPrefix="rule"
                match={form.match}
                keywords={form.keywords}
                pattern={form.pattern}
                required={keywordsRequired(kind)}
                disabled={!writable}
                error={fieldError("trigger.keywords") ?? fieldError("trigger.pattern") ?? fieldError("trigger.match")}
                onChange={(p) => patch(p)}
              />
            ) : null}

            {showScope ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium">{t("editor.scope")}</span>
                  <Segmented<CommentScope>
                    label={t("editor.scope")}
                    value={form.scope}
                    disabled={!writable}
                    onChange={(scope) => patch({ scope, channelAccountId: scope !== "all" && !form.channelAccountId && channelList.length === 1 ? channelList[0]!.id : form.channelAccountId })}
                    options={[
                      { value: "all", label: t("scope.all") },
                      { value: "post", label: t("scope.post") },
                      { value: "next_post", label: t("scope.next_post") },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">{t(`scopeHints.${form.scope}`)}</p>
                </div>
                {form.scope === "post" ? (
                  <div className="space-y-2">
                    {fieldError("trigger.postId") ? (
                      <p role="alert" className="text-sm text-danger">
                        {fieldError("trigger.postId")}
                      </p>
                    ) : null}
                    <PostPicker ws={ws} channelId={form.channelAccountId} value={form.postId} disabled={!writable} onChange={(m) => patch({ postId: m.id })} />
                  </div>
                ) : null}
                {form.scope === "next_post" && rule?.postId ? <p className="text-sm text-muted-foreground">{t("editor.boundTo", { id: rule.postId })}</p> : null}
              </div>
            ) : null}

            {kind === "postback" ? (
              <Field label={t("editor.payload")} htmlFor="rule-payload" hint={t("editor.payloadHint")} error={fieldError("trigger.payload")}>
                <Input id="rule-payload" dir="ltr" maxLength={1000} disabled={!writable} value={form.payload} onChange={(e) => patch({ payload: e.target.value })} />
              </Field>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("editor.then")} description={isCommentTrigger(kind) ? t("editor.thenCommentHint") : t("editor.thenHint")} />
          <CardBody>
            <ActionsEditor ws={ws} triggerKind={kind} actions={form.actions} onChange={(actions) => patch({ actions })} fieldError={fieldError} disabled={!writable} />
          </CardBody>
        </Card>

        <details className="group rounded-2xl border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium sm:p-5">
            {t("editor.advanced")}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
            <Field label={t("editor.cooldown")} htmlFor="rule-cooldown" hint={t("editor.cooldownHint")} error={fieldError("trigger.cooldownMinutes")}>
              <Input
                id="rule-cooldown"
                type="number"
                inputMode="numeric"
                dir="ltr"
                min={0}
                max={43200}
                disabled={!writable}
                value={form.cooldownMinutes ?? ""}
                onChange={(e) => patch({ cooldownMinutes: e.target.value === "" ? null : Math.max(0, Math.min(43200, Number(e.target.value))) })}
              />
            </Field>
            <Field label={t("editor.priority")} htmlFor="rule-priority" hint={t("editor.priorityHint")} error={fieldError("priority")}>
              <Input
                id="rule-priority"
                type="number"
                dir="ltr"
                min={-1000}
                max={1000}
                disabled={!writable}
                value={form.priority}
                onChange={(e) => patch({ priority: Math.max(-1000, Math.min(1000, Number(e.target.value) || 0)) })}
              />
            </Field>
          </div>
        </details>

        {rule ? <RuleStatsPanel rule={rule} /> : null}

        {writable ? (
          <StickyActions>
            <Link href={base} className={buttonVariants({ variant: "outline" })}>
              {t("editor.cancel")}
            </Link>
            <Button type="submit" loading={save.isPending}>
              {rule ? t("editor.save") : t("editor.create")}
            </Button>
          </StickyActions>
        ) : null}
      </form>

      {rule ? (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          danger
          title={t("editor.deleteConfirm")}
          body={rule.name}
          confirmLabel={t("editor.delete")}
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(rule.id, {
              onSuccess: () => {
                toast.success(t("editor.deleted"));
                router.replace(base);
              },
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      ) : null}
    </PageContainer>
  );
}
