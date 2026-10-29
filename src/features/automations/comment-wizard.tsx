"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageContainer } from "@/components/ui/page";
import { Segmented } from "@/components/ui/tabs";
import { Stepper } from "@/features/onboarding/stepper";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { api, unwrap } from "@/lib/api/client";
import type { CommentScope, Media, OutboundContent } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { useSaveRule } from "./data";
import { KeywordInput } from "./keyword-input";
import { MessageBuilder } from "./message-builder";
import { baseVariables, commentVariables, MAX_PUBLIC_REPLIES } from "./model";
import { PostPicker } from "./post-picker";
import { emptyRuleForm, ruleProblems, ruleRequestFromForm, type RuleForm } from "./rule-form";

const STEPS = 4;

/**
 * Comment-to-DM wizard (plan 3.4): pick post → keyword → DM content → public replies → done, with the option to reply to
 * comments already under the post (backlog run). Produces a normal comment rule that the rule editor can open later.
 */
export function CommentWizard() {
  const t = useTranslations("automations.wizard");
  const ta = useTranslations("automations");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const channels = useChannels(ws);
  const save = useSaveRule(ws);
  const [step, setStep] = useState(1);
  const [anyComment, setAnyComment] = useState(false);
  const [post, setPost] = useState<Media | null>(null);
  const [backlog, setBacklog] = useState(true);
  const [form, setForm] = useState<RuleForm>(() => ({
    ...emptyRuleForm("comment_keyword"),
    scope: "post",
    actions: [
      { kind: "private_reply", message: { text: t("defaultDm") } },
      { kind: "public_reply", replies: [t("defaultReply1"), t("defaultReply2"), t("defaultReply3")] },
    ],
  }));
  const channelId = form.channelAccountId ?? (channels.data?.length === 1 ? channels.data[0]!.id : null);
  const patch = (p: Partial<RuleForm>) => setForm((f) => ({ ...f, ...p }));
  const dm = form.actions[0]!.message as OutboundContent;
  const replies = form.actions[1]?.replies ?? [];
  const setDm = (message: OutboundContent) => setForm((f) => ({ ...f, actions: f.actions.map((a, i) => (i === 0 ? { ...a, message } : a)) }));
  const setReplies = (r: string[]) => setForm((f) => ({ ...f, actions: f.actions.map((a, i) => (i === 1 ? { ...a, replies: r } : a)) }));

  const effective: RuleForm = {
    ...form,
    channelAccountId: channelId,
    triggerKind: anyComment ? "comment_any" : "comment_keyword",
    name: form.name.trim() || (anyComment ? t("autoNameAny") : t("autoName", { keyword: form.keywords[0] ?? form.pattern })),
    // An empty public-reply list means «no public reply»: drop the action instead of failing validation.
    actions: replies.some((r) => r.trim()) ? form.actions : form.actions.slice(0, 1),
  };
  const problems = ruleProblems(effective);
  const stepProblems: Record<number, string[]> = {
    1: ["trigger.postId", "channelAccountId"],
    2: ["trigger.keywords", "trigger.pattern"],
    3: ["actions[0].message"],
    4: ["actions[1].replies", "name", "actions"],
  };
  const blocking = (s: number) => stepProblems[s]!.map((k) => problems[k]).find(Boolean);

  const create = () =>
    save.mutate(
      { body: ruleRequestFromForm(effective) },
      {
        onSuccess: async (rule) => {
          if (backlog && form.scope === "post") {
            try {
              unwrap(await api.POST("/api/v1/workspaces/{workspaceId}/automation/rules/{ruleId}/backlog-run", { params: { path: { workspaceId: ws, ruleId: rule.id } } }));
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }
          toast.success(t("created"));
          router.replace(`/w/${ws}/automations/rules/${rule.id}`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const problem = blocking(step);

  return (
    <PageContainer className="max-w-3xl">
      <Link href={`/w/${ws}/automations`} className="text-sm text-muted-foreground hover:text-foreground">
        {ta("title")}
      </Link>
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">{t("title")}</h1>
      <Stepper step={step} total={STEPS} />

      <Card>
        <CardBody className="space-y-5">
          {step === 1 ? (
            <>
              <div>
                <h2 className="font-semibold">{t("step1")}</h2>
                <p className="text-sm text-muted-foreground">{t("step1Hint")}</p>
              </div>
              {(channels.data?.length ?? 0) > 1 ? (
                <Field label={ta("editor.account")} htmlFor="wizard-account">
                  <Select id="wizard-account" value={channelId ?? ""} onChange={(e) => patch({ channelAccountId: e.target.value || null, postId: null })}>
                    <option value="">{t("chooseAccount")}</option>
                    {channels.data!.map((c) => (
                      <option key={c.id} value={c.id}>
                        @{c.username ?? c.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Segmented<CommentScope>
                label={ta("editor.scope")}
                value={form.scope}
                onChange={(scope) => patch({ scope })}
                options={[
                  { value: "post", label: ta("scope.post") },
                  { value: "next_post", label: ta("scope.next_post") },
                  { value: "all", label: ta("scope.all") },
                ]}
              />
              <p className="text-xs text-muted-foreground">{ta(`scopeHints.${form.scope}`)}</p>
              {form.scope === "post" ? (
                <PostPicker
                  ws={ws}
                  channelId={channelId}
                  value={form.postId}
                  onChange={(m) => {
                    setPost(m);
                    patch({ postId: m.id });
                  }}
                />
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div>
                <h2 className="font-semibold">{t("step2")}</h2>
                <p className="text-sm text-muted-foreground">{t("step2Hint")}</p>
              </div>
              <Segmented
                label={t("step2")}
                value={anyComment ? "any" : "keyword"}
                onChange={(v) => setAnyComment(v === "any")}
                options={[
                  { value: "keyword", label: t("withKeyword") },
                  { value: "any", label: t("anyComment") },
                ]}
              />
              {anyComment ? (
                <p className="text-sm text-muted-foreground">{ta("triggerHints.comment_any")}</p>
              ) : (
                <KeywordInput idPrefix="wizard" match={form.match} keywords={form.keywords} pattern={form.pattern} required onChange={(p) => patch(p)} />
              )}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <h2 className="font-semibold">{t("step3")}</h2>
                <p className="text-sm text-muted-foreground">{ta("actions.privateReplyHint")}</p>
              </div>
              <MessageBuilder id="wizard-dm" value={dm} onChange={setDm} variables={[...baseVariables, ...commentVariables]} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div>
                <h2 className="font-semibold">{t("step4")}</h2>
                <p className="text-sm text-muted-foreground">{ta("actions.publicReplyHint")}</p>
              </div>
              <div className="space-y-2">
                {replies.map((r, i) => (
                  <Input
                    key={i}
                    dir="auto"
                    maxLength={300}
                    aria-label={ta("actions.replyVariant", { n: toPersianDigits(i + 1) })}
                    value={r}
                    onChange={(e) => setReplies(replies.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                ))}
                {replies.length < MAX_PUBLIC_REPLIES ? (
                  <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setReplies([...replies, ""])}>
                    {ta("actions.addVariant")}
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">{t("emptyRepliesHint")}</p>
              </div>
              <Field label={ta("editor.name")} htmlFor="wizard-name" hint={t("nameHint")}>
                <Input id="wizard-name" dir="auto" maxLength={100} value={form.name} placeholder={effective.name} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              {form.scope === "post" ? (
                <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--color-primary)]" checked={backlog} onChange={(e) => setBacklog(e.target.checked)} />
                  <span>
                    <span className="block font-medium">{t("backlog")}</span>
                    <span className="block text-xs text-muted-foreground">{t("backlogHint")}</span>
                  </span>
                </label>
              ) : null}
              <Summary post={post} form={effective} />
            </>
          ) : null}

          {problem ? <p className="text-sm text-muted-foreground">{codeMessage(problem)}</p> : null}
        </CardBody>
      </Card>

      <div className="mt-4 flex justify-between gap-2">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            {t("back")}
          </Button>
        ) : (
          <Link href={`/w/${ws}/automations`} className={buttonVariants({ variant: "outline" })}>
            {t("cancel")}
          </Link>
        )}
        {step < STEPS ? (
          <Button disabled={Boolean(problem)} onClick={() => setStep(step + 1)}>
            {t("next")}
          </Button>
        ) : (
          <Button disabled={Boolean(problem) || Object.keys(problems).length > 0} loading={save.isPending} onClick={create}>
            <Check aria-hidden />
            {t("create")}
          </Button>
        )}
      </div>
    </PageContainer>
  );
}

function Summary({ post, form }: { post: Media | null; form: RuleForm }) {
  const t = useTranslations("automations.wizard");
  const ta = useTranslations("automations");
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3 text-sm leading-7">
      <p className="font-medium">{t("summary")}</p>
      <ul className="list-inside list-disc text-muted-foreground">
        <li>{form.scope === "post" ? t("summaryPost", { caption: post?.caption?.slice(0, 40) || "—" }) : ta(`scope.${form.scope}`)}</li>
        <li>{form.triggerKind === "comment_any" ? t("anyComment") : t("summaryKeywords", { keywords: (form.match === "pattern" ? [form.pattern] : form.keywords).join("، ") })}</li>
        <li>{t("summaryDm")}</li>
        {form.actions.length > 1 ? <li>{t("summaryReplies", { n: toPersianDigits((form.actions[1]?.replies ?? []).filter((r) => r.trim()).length) })}</li> : null}
      </ul>
    </div>
  );
}
